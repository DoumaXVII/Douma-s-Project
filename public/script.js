// Common utility functions
function displayMessage(message, isError) {
    const messageDiv = document.getElementById('responseMessage');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.style.color = isError ? 'red' : 'green';
    }
}

async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    return response.json();
}

// =====================
// Registration handling
// =====================
if (document.getElementById('registrationForm')) {
    const form = document.getElementById('registrationForm');
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const username = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const region = document.getElementById('region').value.trim();

        if (!username || !email || !password || !region) {
            displayMessage('Please fill in all fields.', true);
            return;
        }

        // Username validation
        if (username.length < 3) {
            displayMessage('Username must be at least 3 characters long.', true);
            return;
        }

        // Username format validation
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(username)) {
            displayMessage('Username can only contain letters, numbers, underscores and dashes.', true);
            return;
        }

        // Password length validation
        if (password.length < 8 || password.length > 17) {
            displayMessage('Password must be between 8 and 17 characters.', true);
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            displayMessage('Please enter a valid email address.', true);
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: username, email, password, region })
            });

            const result = await response.json();

            if (response.ok) {
                displayMessage('Registration successful! Redirecting to login...', false);
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1000);
            } else {
                displayMessage(result.message || 'Registration failed.', true);
            }
        } catch (error) {
            displayMessage('Error connecting to server.', true);
        }
    });
}

// =====================
// Login handling
// =====================
if (document.getElementById('loginForm')) {
    const form = document.getElementById('loginForm');

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            displayMessage('Please enter your username and password.', true);
            return;
        }

        // Username validation
        if (username.length < 3) {
            displayMessage('Username must be at least 3 characters long.', true);
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (response.ok) {
                localStorage.setItem('username', username);
                displayMessage('Login successful! Redirecting...', false);
                setTimeout(() => {
                    window.location.href = '/profile.html';
                }, 1000);
            } else {
                displayMessage(result.message || 'Login failed.', true);
            }
        } catch (error) {
            displayMessage('Error connecting to server.', true);
        }
    });
}

// =====================
// Profile handling
// =====================
if (document.getElementById('profileInfo')) {
    // Check if user is logged in
    const username = localStorage.getItem('username');
    if (!username) {
        window.location.href = '/login.html';
    } else {
        loadProfile();
    }

    // Handle profile picture upload
    if (document.getElementById('imageUpload')) {
        document.getElementById('imageUpload').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                displayMessage('Please select an image file.', true);
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                displayMessage('File size should be less than 5MB.', true);
                return;
            }

            const formData = new FormData();
            formData.append('profilePicture', file);

            try {
                const response = await fetch('/upload-profile-picture', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    document.getElementById('profilePicture').src = result.imageUrl;
                    displayMessage('Profile picture updated successfully!', false);
                } else {
                    displayMessage(result.message || 'Failed to upload profile picture.', true);
                }
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                displayMessage('Error uploading profile picture.', true);
            }
        });
    }
}

async function loadProfile() {
    try {
        const response = await fetch('/profile');
        const user = await response.json();
        
        if (response.ok) {
            document.getElementById('username').textContent = user.username || '';
            document.getElementById('email').textContent = user.email || '';
            document.getElementById('region').textContent = user.region || '';
            
            // Update profile picture if user has one
            if (user.profilePicture) {
                document.getElementById('profilePicture').src = user.profilePicture;
            }
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        localStorage.removeItem('username');
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error during logout:', error);
        window.location.href = '/login.html';
    }
}
