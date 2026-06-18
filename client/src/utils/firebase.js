
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB3v4lXlUZ6Oy3tEuqYdiRnnancUIK-gxY",
  authDomain: "assey-cbc7a.firebaseapp.com",
  projectId: "assey-cbc7a",
  storageBucket: "assey-cbc7a.firebasestorage.app",
  messagingSenderId: "1062468979448",
  appId: "1:1062468979448:web:1bffac9cb5ac79b63e490d",
  measurementId: "G-ZGH6H6W50C"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider()

export {auth , provider}