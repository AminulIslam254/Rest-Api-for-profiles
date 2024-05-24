const express = require('express');
const asyncHandler = require('express-async-handler');
const GitHubStrategy = require('passport-github').Strategy;
const passport = require('passport');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 13000;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});

const upload = multer({ storage: storage });


let users = [];
let YOUR_GITHUB_CLIENT_ID="";
let YOUR_GITHUB_CLIENT_SECRET="";

if (!YOUR_GITHUB_CLIENT_ID || !YOUR_GITHUB_CLIENT_SECRET) {
    console.error("GitHub Client ID or Client Secret not provided. Application will not work properly.");
    process.exit(1); // Exit the application with an error code
}

app.use(express.json());
passport.use(new GitHubStrategy({
    clientID: YOUR_GITHUB_CLIENT_ID,
    clientSecret: YOUR_GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));




app.use(passport.initialize());

function isAdmin(req, res, next) {
    const isAdmin = req.headers['is-admin'];
    if (isAdmin && isAdmin === 'true') {
        req.user = { isAdmin: true };
        return next();
    }
    res.status(401).json({ message: "Unauthorized" });
}


app.post('/register', asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Please provide username, email, and password" });
    }
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
    }

    const newUser = {
        id: users.length + 1,
        username,
        email,
        password
    };

    users.push(newUser);

    return res.status(201).json({ message: "User registered successfully", user: newUser });
}));

app.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Please provide email and password" });
    }
    const user = users.find(user => user.email === email);

    if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.status(200).json({ message: "Login successful", user });
}));

// Route for starting GitHub authentication
app.get('/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

// Route for GitHub authentication callback
app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/profile');
  }
);

// Route for a protected profile page
app.get('/profileProtected', isAuthenticated, asyncHandler((req, res) => {
  res.send(`Hello, ${req.user.displayName}!`);
}));

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

app.get('/logout',asyncHandler((req, res) => {
    req.logout();
    res.redirect('/');
}));

// Route for viewing profile details
app.get('/profile', isAuthenticated, asyncHandler((req, res) => {
    res.json(req.user);
}));

// Route for editing profile details
app.put('/profile', isAuthenticated, asyncHandler((req, res) => {
    const { name, email, phone, password } = req.body;
    const user = users.find(user => user.id === req.user.id);
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password) user.password = password;

    res.json({ message: "Profile details updated successfully", user });
}));

// Route for uploading a new photo
app.post('/upload', isAuthenticated, upload.single('photo'), asyncHandler((req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: "Please upload a file" });
    }
    const user = users.find(user => user.id === req.user.id);
    user.photo = `/uploads/${file.filename}`;

    res.json({ message: "Photo uploaded successfully", photoUrl: user.photo });
}));

// Route for providing an image URL
app.post('/photo-url', isAuthenticated,asyncHandler( (req, res) => {
    const { imageUrl } = req.body;

    const user = users.find(user => user.id === req.user.id);
    user.photo = imageUrl;

    res.json({ message: "Photo URL updated successfully", photoUrl: user.photo });
}));

// Route for updating profile privacy
app.put('/profile/privacy', isAuthenticated, asyncHandler((req, res) => {
    const { isPublic } = req.body;

    const user = users.find(user => user.id === req.user.id);
    if (user) {
        user.isPublic = isPublic;
        res.json({ message: "Profile privacy updated successfully", isPublic: user.isPublic });
    } else {
        res.status(404).json({ message: "User not found" });
    }
}));

// Route for fetching user profiles
app.get('/profiles', isAdmin, asyncHandler((req, res) => {
    const isAdmin = req.user.isAdmin;
    const profiles = isAdmin ? users : users.filter(user => user.isPublic);

    res.json({ profiles });
}));

// Route for fetching public user profiles
app.get('/public-profiles', asyncHandler((req, res) => {
    const publicProfiles = users.filter(user => user.isPublic);
    res.json({ publicProfiles });
}));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
