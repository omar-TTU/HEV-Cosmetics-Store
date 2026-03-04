const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const admin = require('firebase-admin'); 

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 1. الاتصال بقاعدة بيانات Firebase (آمن جداً)
// ==========================================
let serviceAccount;

// فحص المكان الذي يعمل فيه السيرفر
if (process.env.FIREBASE_KEY) {
    // 1. إذا كان يعمل على سيرفر Render (يأخذ المفتاح من الإعدادات السحابية)
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} else {
    // 2. إذا كان يعمل على جهازك المحلي (يقرأ الملف المحلي)
    serviceAccount = require('./serviceAccountKey.json'); 
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); 
console.log('✅ تم الاتصال بقاعدة بيانات Firebase بنجاح!');
// ==========================================
// 2. مسارات الصفحات
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));

// ==========================================
// 3. مسار إنشاء حساب جديد (حفظ في فايربيس)
// ==========================================
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const usersRef = db.collection('users'); // نحدد مجموعة "المستخدمين"
        
        // البحث هل الإيميل موجود مسبقاً؟
        const snapshot = await usersRef.where('email', '==', email).get();
        if (!snapshot.empty) {
            return res.status(400).json({ success: false, message: "هذا البريد الإلكتروني مسجل مسبقاً!" });
        }

        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);

        // إنشاء مستخدم جديد وحفظه في فايربيس
        await usersRef.add({
            name: name,
            email: email,
            password: hashedPassword
        });

        console.log(`تم حفظ زبون جديد في فايربيس: ${name}`);
        res.json({ success: true, message: "تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "حدث خطأ في السيرفر." });
    }
});

// ==========================================
// 4. مسار تسجيل الدخول (البحث في فايربيس)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const usersRef = db.collection('users');
        // البحث عن المستخدم بالإيميل
        const snapshot = await usersRef.where('email', '==', email).get();

        if (snapshot.empty) {
            return res.status(401).json({ success: false, message: "البريد الإلكتروني غير مسجل!" });
        }

        // استخراج بيانات المستخدم من فايربيس
        let foundUser = null;
        snapshot.forEach(doc => {
            foundUser = doc.data();
        });

        // فك التشفير ومقارنة كلمة المرور
        const isMatch = await bcrypt.compare(password, foundUser.password);

        if (isMatch) {
            console.log(`تم دخول المستخدم: ${foundUser.name}`);
            // أضفنا userEmail هنا لكي نستخدمه في صلاحيات الأدمن
            res.json({ success: true, userName: foundUser.name, userEmail: foundUser.email, message: `أهلاً بك يا ${foundUser.name} في متجر HEV!` });
        } else {
            res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة!" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "حدث خطأ في السيرفر." });
    }
});

// ==========================================
// مسار خاص بالأدمن: جلب جميع المستخدمين
// ==========================================
app.get('/api/admin/users', async (req, res) => {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        const usersList = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // نرسل الاسم والإيميل فقط (ممنوع إرسال الباسوورد المشفر للأمان)
            usersList.push({ name: data.name, email: data.email }); 
        });

        res.json({ success: true, users: usersList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء جلب البيانات." });
    }
});

// ==========================================
// مسار خاص بالأدمن: إضافة منتج جديد
// ==========================================
app.post('/api/admin/products', async (req, res) => {
    try {
        // استلام بيانات المنتج (بما فيها مصفوفة الصور)
        const { name, price, description, category, images } = req.body;

        // حفظ المنتج في مجموعة (collection) جديدة اسمها 'products'
        const productsRef = db.collection('products');
        await productsRef.add({
            name: name,
            price: Number(price), // تأكيد أن السعر رقم وليس نص
            description: description,
            category: category,
            images: images, // 🌟 هذه مصفوفة ستحتوي على عدة صور
            createdAt: admin.firestore.FieldValue.serverTimestamp() // وقت الإضافة
        });

        console.log(`تمت إضافة المنتج بنجاح: ${name}`);
        res.json({ success: true, message: "تمت إضافة المنتج بنجاح إلى قاعدة البيانات!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء حفظ المنتج." });
    }
});

// ==========================================
// مسار جلب المنتجات وعرضها في المتجر
// ==========================================
app.get('/api/products', async (req, res) => {
    try {
        const productsRef = db.collection('products');
        // جلب المنتجات وترتيبها من الأحدث للأقدم
        const snapshot = await productsRef.orderBy('createdAt', 'desc').get();
        const productsList = [];
        
        snapshot.forEach(doc => {
            // نرسل الـ ID الخاص بالمنتج مع بياناته لكي نستخدمه لاحقاً
            productsList.push({ id: doc.id, ...doc.data() }); 
        });

        res.json({ success: true, products: productsList });
    } catch (error) {
        console.error("خطأ في جلب المنتجات:", error);
        res.status(500).json({ success: false, message: "حدث خطأ أثناء جلب المنتجات." });
    }
});

// المنفذ يتم جلبه من البيئة السحابية أو 3000 للتجربة المحلية
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});