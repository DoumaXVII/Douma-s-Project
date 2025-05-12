const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware to parse JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser middleware
app.use(cookieParser());

// Session middleware setup
app.use(session({
  secret: 'simple_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // secure: false for HTTP, true for HTTPS
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Data file path
const dataFilePath = path.join(__dirname, 'data', 'users.json');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

// Ensure data and uploads directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, '[]', 'utf8');
}

// Sanitize input function
function sanitizeInput(str) {
    return str.replace(/[<>&"']/g, function(match) {
        const escape = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;'
        };
        return escape[match];
    });
}

// POST endpoint to handle registration form submission
app.post('/register', async (req, res) => {
  const userData = {
    username: sanitizeInput(req.body.name || ''),
    email: sanitizeInput(req.body.email || ''),
    password: req.body.password,
    region: sanitizeInput(req.body.region || '')
  };

  // Simple validation
  if (!userData.username || !userData.email || !userData.password || !userData.region) {
    return res.status(400).json({ message: 'Username, email, password, and region are required.' });
  }

  // Username validation
  if (userData.username.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters long.' });
  }

  // Username format validation
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(userData.username)) {
    return res.status(400).json({ message: 'Username can only contain letters, numbers, underscores and dashes.' });
  }

  // Password length validation
  if (userData.password.length < 8 || userData.password.length > 17) {
    return res.status(400).json({ message: 'Password must be between 8 and 17 characters long.' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  // Read existing users
  let users = [];
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    users = JSON.parse(data);
  } catch (err) {
    console.error('Error reading users data:', err);
  }

  // Check if username or email already exists
  if (users.find(u => u.username === userData.username)) {
    return res.status(400).json({ message: 'Username already taken.' });
  }
  if (users.find(u => u.email === userData.email)) {
    return res.status(400).json({ message: 'Email already registered.' });
  }

  // Hash password
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    userData.password = hashedPassword;
  } catch (err) {
    console.error('Error hashing password:', err);
    return res.status(500).json({ message: 'Failed to process password.' });
  }
  // Add new user with default profile picture
  userData.profilePicture = '/uploads/avatar.png';
  users.push(userData);

  // Save updated users
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users data:', err);
    return res.status(500).json({ message: 'Failed to save user data.' });
  }
  // Set a session variable and cookie as a bonus
  req.session.user = userData.username;
  res.cookie('username', userData.username, { maxAge: 900000, httpOnly: true });

  res.json({ 
    message: 'Registration successful', 
    user: { 
      username: userData.username, 
      email: userData.email, 
      region: userData.region,
      profilePicture: userData.profilePicture
    } 
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  let users = [];
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    users = JSON.parse(data);
  } catch (err) {
    console.error('Error reading users data:', err);
    return res.status(500).json({ message: 'Internal server error reading users data.' });
  }

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(400).json({ message: 'User not found.' });
  }

  // Compare password
  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }
  } catch (err) {
    console.error('Error comparing password:', err);
    return res.status(500).json({ message: 'Failed to verify password.' });
  }
  req.session.user = user.username;
  res.cookie('username', user.username, { maxAge: 900000, httpOnly: true });

  res.json({ 
    message: 'Login successful', 
    user: { 
      username: user.username, 
      email: user.email, 
      region: user.region,
      profilePicture: user.profilePicture || '/uploads/avatar.png'
    } 
  });
});

app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let users = [];
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    users = JSON.parse(data);
  } catch (err) {
    console.error('Error reading users data:', err);
  }
  const user = users.find(u => u.username === req.session.user);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  res.json({ 
    username: user.username, 
    email: user.email, 
    region: user.region,
    profilePicture: user.profilePicture || '/uploads/avatar.png'
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('username');
    res.json({ message: 'Logged out' });
  });
});

const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'uploads'))
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.session.user}${ext}`)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image file'), false);
    }
  }
});

// Profile picture upload endpoint
app.post('/upload-profile-picture', upload.single('profilePicture'), (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  
  // Update user's profile picture in users.json
  try {
    const users = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    const userIndex = users.findIndex(u => u.username === req.session.user);
    if (userIndex !== -1) {
      users[userIndex].profilePicture = imageUrl;
      fs.writeFileSync(dataFilePath, JSON.stringify(users, null, 2));
    }
  } catch (err) {
    console.error('Error updating user profile picture:', err);
  }

  res.json({ 
    message: 'Profile picture uploaded successfully',
    imageUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});