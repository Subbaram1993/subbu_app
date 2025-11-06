const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Get the machine's IP address (for external access)
const getIPAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const iface in interfaces) {
        for (const addr of interfaces[iface]) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return 'localhost';
};

const ipAddress = getIPAddress();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// JSON File Path
const userFilePath = path.join(__dirname, 'users.json');

// Ensure `users.json` exists
const readUsersFromFile = () => {
    if (!fs.existsSync(userFilePath)) {
        fs.writeFileSync(userFilePath, JSON.stringify([], null, 2)); // Create file if missing
    }
    const data = fs.readFileSync(userFilePath, 'utf-8');
    return data ? JSON.parse(data) : [];
};

// Write Users to File
const writeUsersToFile = (users) => {
    fs.writeFileSync(userFilePath, JSON.stringify(users, null, 2));
};

// Home Page Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Signup Route
app.post('/signup', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    const users = readUsersFromFile();
    const existingUser = users.find(user => user.username === username);
    
    if (existingUser) {
        return res.status(400).send('User already exists');
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).send('Error hashing password');
        }

        const newUser = { username, password: hash };
        users.push(newUser);
        writeUsersToFile(users);

        console.log('New user registered:', username); // Only log username
        res.status(201).send('Signup successful');
    });
});

// Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    const users = readUsersFromFile();
    console.log('Existing users:', users.map(user => user.username)); // Only log usernames

    const user = users.find(user => user.username === username);

    if (!user) {
        console.log(`Login failed: User ${username} not found`);
        return res.status(401).send('User not found');
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
            console.error('Error comparing passwords:', err);
            return res.status(500).send('Error comparing passwords');
        }

        if (!isMatch) {
            console.log(`Login failed for user: ${username}`);
            return res.status(401).send('Invalid password');
        }

        console.log(`User logged in: ${username}`);
        res.send('Login successful');
    });
});

// Start the Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://${ipAddress}:${PORT} or http://localhost:${PORT}`);
});
