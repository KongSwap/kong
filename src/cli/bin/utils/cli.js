import { exec } from 'child_process';
export const delay = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
// Promisified exec
export const execAsync = (command, options = {}) => {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout ? stdout.toString().trim() : '');
        });
    });
};
