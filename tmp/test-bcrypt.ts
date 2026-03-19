import bcrypt from 'bcryptjs';

const password = 'test';
const hash = bcrypt.hashSync(password, 10);
const isValid = bcrypt.compareSync(password, hash);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('Is Valid:', isValid);
