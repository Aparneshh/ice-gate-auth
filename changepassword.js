// changePassword.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB = path.join(__dirname,'users.db');
const username = process.argv[2];
const newPass = process.argv[3];

if (!username || !newPass) {
  console.error('Usage: node changePassword.js <username> <newPassword>');
  process.exit(1);
}

(async ()=> {
  const hash = await bcrypt.hash(newPass, 10);
  const db = new sqlite3.Database(DB);
  db.run('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username], function(err){
    if (err) { console.error(err); process.exit(1); }
    console.log('Updated', this.changes, 'rows for', username);
    process.exit(0);
  });
})();