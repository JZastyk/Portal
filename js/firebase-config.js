/* Конфигурация Firebase и глобальные ссылки на разделы БД */
const firebaseConfig = {
  apiKey: "AIzaSyB645W3HUH1e5wmFvN50DFHzAHDUaysgpY",
  authDomain: "himiya-uchet.firebaseapp.com",
  databaseURL: "https://himiya-uchet-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "himiya-uchet",
  storageBucket: "himiya-uchet.firebasestorage.app",
  messagingSenderId: "591207429538",
  appId: "1:591207429538:web:510528c6a80fcd413b6efb"
};
firebase.initializeApp(firebaseConfig);

/* Анонимная авторизация нужна, чтобы правила Firebase (auth != null)
   пускали приложение к базе, но не пускали случайных ботов и запросы
   напрямую по ссылке в обход приложения. В консоли Firebase должен
   быть включён провайдер входа "Anonymous" (Authentication → Sign-in method). */
firebase.auth().signInAnonymously().catch(function(err){
  console.error('Не удалось выполнить анонимную авторизацию Firebase:', err);
});

const locationsRef = firebase.database().ref('carwashes');
let dbRef, reportDbRef, settingsRef, reportsHistoryRef;
