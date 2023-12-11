const { Client } = require('pg');
const express = require('express');
const multer  = require('multer');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new Client({
    user: 'postgres',
    host: 'db',
    database: 'mydb',
    password: 'example',
    port: 5432,
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const connectWithRetry = () => {
    console.log('Postgres connection starting...');
    client.connect((err) => {
        if (err) {
            console.error('Failed to connect to postgres on startup - retrying in 5 sec', err);
            setTimeout(connectWithRetry, 5000);
        }
        else 
        {
         console.log(client.host);
        }
    });
};

setTimeout(connectWithRetry, 7000);

function encrypt(text, password) {
    const cipher = crypto.createCipher('aes-256-cbc', password);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encrypted, password) {
    const decipher = crypto.createDecipher('aes-256-cbc', password);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function verify(token)
{
    let unamepluspasswd = decrypt(token, "wegatnorules").split('\\');
    console.log(unamepluspasswd[0])
    client.query('SELECT userName FROM noruuser WHERE userName = $1', [unamepluspasswd[0]], 
    (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while auth');
        } else if (result.rows.length > 0) {
            return unamepluspasswd[0]
        } 
        else 
        {
            return "NO_USER"
        }
    });
    return unamepluspasswd[0]
}
  
app.use(cors());

app.get('/', (req, res) => {
    
    res.render('index', {});
});
app.get('/whoami', (req, res) => {
    res.render('reglog', {});
});

app.get('/profile', (req, res) => {
    const token = req.cookies.token;
    let current_user = verify(token);
    res.render('message', { message: "Вы - "+current_user+"!"});
});

app.get('/delete/:filename', (req, res) => {
    const token = req.cookies.token;
    let current_user = verify(token);
    const filename = req.params.filename;
    client.query('DELETE FROM entity WHERE entityUser = $1 AND entityName = $2', [current_user, filename], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while fetching file');
        } else if (result.rows.length > 0) {
            res.render('message', { message: result.rows[0]});
        } else {
            res.render('message', { message: 'Файл удалён или не найден.'});
        }
    });
});
app.post('/register', (req, res) => {
    console.log('Регистрация:');
    console.log('Имя пользователя:', req.body.username);
    console.log('Пароль:', req.body.password);
    client.query('INSERT INTO noruuser (userName, userPassword) VALUES ($1, $2)', 
    [req.body.username, req.body.password], (err, res) => {
        console.log(err, res);
    });
    res.render('message', { message: "Пользователь зарегистрирован!"});
});

app.post('/login', (req, res) => {
    console.log('Вход:');
    console.log('Имя пользователя:', req.body.username);
    console.log('Пароль:', req.body.password);
    client.query('SELECT userName FROM noruuser WHERE userName = $1 AND userPassword = $2', [req.body.username,
        req.body.password], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while fetching file');
        } else if (result.rows.length > 0) {
            res.cookie('token', encrypt(req.body.username+"\\"+req.body.password, "wegatnorules"));
            res.render('message', { message: "Вы в системе!"});
        } 
        else 
        {
            res.render('message', { message: "Вход не выполнен."});
        }
    });
});
app.post('/send-file', upload.single('file'), (req, res) => {
    const token = req.cookies.token;
    let current_user = verify(token);
    console.log('Received file:', req.file);
    //console.log('Received:', req);
    let filename = req.file.filename
    let folderName = req.body.folder
    client.query('SELECT entityName FROM entity WHERE entityName = $1 AND entityUser = $2', [req.file.originalname, current_user], 
    (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while fetching file');
        } else if (result.rows.length > 0) {
            client.query('UPDATE entity SET entityName=$1, '+
            'entityFolder=$2, entityType=$3, entityPath=$4, entityUser=$5 where entityName=$1', 
            [req.file.originalname, folderName, req.file.mimetype, filename, current_user], (err, res) => {
                console.log(err, res);
            });
        } 
        else 
        {
            client.query('INSERT INTO entity (entityName, entityFolder, entityType, entityPath, entityUser) VALUES ($1, $2, $3, $4, $5)', 
            [req.file.originalname, folderName, req.file.mimetype, filename, current_user], (err, res) => {
                console.log(err, res);
            });
        }
    });
    res.json({ message: 'File received successfully!' });
    
});

app.get('/get/:filename', (req, res) => {
    const filename = req.params.filename;
    client.query('SELECT entityPath FROM entity WHERE entityName = $1', [filename], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while fetching file');
        } else if (result.rows.length > 0) {
            const entityPath = result.rows[0].entitypath;
            res.sendFile(path.resolve(__dirname, 'uploads', entityPath));
        } else {
            res.status(404).send('File not found');
        }
    });
});
app.get('/get/:folder/:filename', (req, res) => {
    const filename = req.params.filename;
    const folder = req.params.folder;
    client.query('SELECT entityPath FROM entity WHERE entityName = $1 AND entityFolder = $2', [filename, folder], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while fetching file');
        } else if (result.rows.length > 0) {
            const entityPath = result.rows[0].entitypath;
            res.sendFile(path.resolve(__dirname, 'uploads', entityPath));
        } else {
            res.status(404).send('File not found');
        }
    });
});

app.get('/get', (req, res) => {
    const token = req.cookies.token;
    let current_user = verify(token);
    client.query('SELECT entityName FROM entity WHERE entityUser = $1 ', [current_user], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error occurred while fetching file');
        } else {
            let resp = []
            for (let i = 0; i < result.rows.length; ++i)
            {
                resp.push(result.rows[i]["entityname"])
            }
            res.render('getfiles', { name: current_user, 
                showList: result.rows.length > 0, 
                items: resp });
        } 
    });
});

app.listen(8080, () => console.log('Server is running on port 8080'));
