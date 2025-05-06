import * as fs from 'fs';
import * as path from 'path';

export function mergeFiles(inputDir: string, outputFilePath: string): void {
    const javaFiles: string[] = [];
    const imports: Set<string> = new Set();
    let mainClassContent = '';
    const otherClasses: string[] = [];
    const definedClasses: Set<string> = new Set();
    let mainClassName = '';

    function collectJavaFiles(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                collectJavaFiles(fullPath);
            } else if (entry.name.endsWith('.java')) {
                javaFiles.push(fullPath);
            }
        }
    }

    function extractClassNames(content: string): void {
        const regex = /\b(public\s+)?(abstract\s+|final\s+)?(class|interface|enum)\s+(\w+)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            definedClasses.add(match[4]);
        }
    }

    function extractFileContent(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        extractClassNames(content);

        const lines = content.split('\n').filter(line => !line.startsWith('package'));
        const bodyLines: string[] = [];

        for (let line of lines) {
            if (line.startsWith('import')) {
                const imp = line.trim();
                const match = imp.match(/import\s+([\w.]+)\.(\w+);/);

                if (match) {
                    const importedClass = match[2];
                    if (!definedClasses.has(importedClass)) {
                        imports.add(imp);
                    }
                } else {
                    imports.add(imp);
                }
            } else {
                bodyLines.push(line);
            }
        }

        const body = bodyLines.join('\n');

        const mainMatch = body.match(/public\s+class\s+(\w+)[\s\S]*?public\s+static\s+void\s+main\s*\(/);
        if (mainMatch) {
            mainClassName = mainMatch[1];
            mainClassContent = body;
        } else {
            const nonPublicBody = body.replace(
                /\bpublic\s+((?:abstract\s+|final\s+)?)(class|interface|enum)/g,
                '$1$2'
            );
            otherClasses.push(nonPublicBody);
        }
    }

    // === START EXECUTION ===
    if (!fs.existsSync(inputDir)) {
        console.error(`Input directory does not exist: ${inputDir}`);
        return;
    }

    collectJavaFiles(inputDir);

    if (javaFiles.length === 0) {
        console.error('No .java files found.');
        return;
    }

    for (const filePath of javaFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        extractClassNames(content);
    }

    for (const filePath of javaFiles) {
        extractFileContent(filePath);
    }

    if (!mainClassContent || !mainClassName) {
        console.error('Error: No class with main method found.');
        return;
    }

    const finalContent = [
        ...Array.from(imports).sort(),
        '',
        ...otherClasses,
        '',
        mainClassContent
    ].join('\n\n');

    fs.writeFileSync(outputFilePath, finalContent, 'utf-8');
    console.log(`✅ Merged file created: ${outputFilePath}`);
}