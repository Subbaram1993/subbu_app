const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = crypto.randomBytes(32).toString('hex'); // Secret for signing JWT tokens

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory

// Path to the JSON file
const userFilePath = path.join(__dirname, 'users.json');

// Function to read users from the JSON file
const readUsersFromFile = () => {
    if (!fs.existsSync(userFilePath)) {
        return [];
    }
    const data = fs.readFileSync(userFilePath);
    return JSON.parse(data);
};

// Function to write users to the JSON file
const writeUsersToFile = (users) => {
    fs.writeFileSync(userFilePath, JSON.stringify(users, null, 2));
};

// Home route (serves index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Signup route
app.post('/signup', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const users = readUsersFromFile();
    const existingUser = users.find(user => user.username === username);

    if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error hashing password' });
        }

        const newUser = { username, password: hash };
        users.push(newUser);
        writeUsersToFile(users);

        // Send success message to client
        res.status(201).json({ message: 'User created successfully. You can now log in.' });
    });
});

// Login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const users = readUsersFromFile();
    const user = users.find(user => user.username === username);

    if (!user) {
        return res.status(401).json({ message: 'User not found' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error comparing passwords' });
        }

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Generate a JWT token on successful login
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });

        // Send token and success message to the client
        res.json({ message: 'Login successful', token });
    });
});

// Function to fetch the Ngrok forwarding URL
const fetchNgrokUrl = () => {
    return new Promise((resolve, reject) => {
        const urls = ['http://127.0.0.1:4040/api/tunnels', 'http://127.0.0.1:4041/api/tunnels']; // Check both ports
        let triedUrls = 0;

        const tryFetch = (apiUrl) => {
            http.get(apiUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.tunnels && json.tunnels.length > 0) {
                            resolve(json.tunnels[0].public_url);
                        } else {
                            reject(new Error('No public URL found'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', () => {
                triedUrls++;
                if (triedUrls < urls.length) {
                    tryFetch(urls[triedUrls]); // Try the next URL
                } else {
                    reject(new Error('Ngrok API is not accessible on known ports (4040, 4041)'));
                }
            });
        };

        tryFetch(urls[0]); // Start with first URL
    });
};

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);

    // Check if Ngrok is running before attempting to kill it
    const checkNgrokCommand = 'pgrep -x ngrok';
    exec(checkNgrokCommand, (error, stdout, stderr) => {
        if (error) {
            console.log('Ngrok is not running, skipping kill.');
        } else {
            const killNgrokCommand = 'pkill -9 ngrok';
            exec(killNgrokCommand, (killError, killStdout, killStderr) => {
                if (killError) {
                    console.error(`Error killing Ngrok: ${killError.message}`);
                } else {
                    console.log(`Ngrok process killed.`);
                }
            });
        }

        // Execute the start_ngrok1.sh script after handling the previous Ngrok session
        const ngrokCommand = 'bash start_ngrok1.sh'; // Use 'bash' or 'sh' depending on your shell
        const ngrokProcess = exec(ngrokCommand, { shell: true });

        // Capture and display stdout from Ngrok
        ngrokProcess.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        // Capture and display stderr (errors)
        ngrokProcess.stderr.on('data', (data) => {
            console.error(`Ngrok Error: ${data.toString()}`);
        });

        // Handle when Ngrok process exits
        ngrokProcess.on('exit', (code) => {
            console.log(`Ngrok process exited with code ${code}`);
        });

        // Wait for a few seconds and fetch the forwarding URL using the Ngrok API
        setTimeout(() => {
            fetchNgrokUrl()
                .then((forwardingUrl) => {
                    console.log(`Ngrok forwarding URL: ${forwardingUrl}`);
                })
                .catch((error) => {
                    console.error(`Error fetching Ngrok URL: ${error.message}`);
                });
        }, 5000); // Wait 5 seconds to ensure Ngrok has started
    });
});
