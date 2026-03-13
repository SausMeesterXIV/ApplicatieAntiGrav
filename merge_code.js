import fs from 'fs';
import path from 'path';

// Mappen en bestanden die we willen meenemen
const directoriesToScan = ['./src'];
const specificFiles = ['./supabase.sql'];
const outputFile = 'complete_codebase.txt';

// Extensies die we willen bundelen (geen afbeeldingen etc)
const allowedExtensions = ['.ts', '.tsx', '.sql', '.json'];

let outputContent = '';

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else {
            const ext = path.extname(fullPath);
            if (allowedExtensions.includes(ext)) {
                appendFileContent(fullPath);
            }
        }
    }
}

function appendFileContent(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Voeg een duidelijke header toe zodat NotebookLM weet in welk bestand hij kijkt
    outputContent += `\n\n========================================================\n`;
    outputContent += `FILE: ${filePath}\n`;
    outputContent += `========================================================\n\n`;
    outputContent += content;
}

// 1. Scan de mappen
directoriesToScan.forEach(dir => scanDirectory(dir));

// 2. Voeg specifieke losse bestanden toe (zoals je database rules)
specificFiles.forEach(file => {
    if (fs.existsSync(file)) appendFileContent(file);
});

// 3. Schrijf alles naar 1 groot txt bestand
fs.writeFileSync(outputFile, outputContent);
console.log(`✅ Succes! Alle code is samengevoegd in: ${outputFile}`);
