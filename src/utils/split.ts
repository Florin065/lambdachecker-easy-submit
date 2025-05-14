import * as fs from 'fs';
import * as path from 'path';

export function splitMergedJavaFile(filePath: string, outputDir: string): void {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const importLines: string[] = [];
    const typeBlocks: { name: string; content: string[] }[] = [];

    let currentBlock: string[] = [];
    let currentName = '';
    let inType = false;

    const typeRegex = /^\s*(public\s+)?((?:abstract\s+|final\s+)?)(class|interface|enum)\s+(\w+)/;

    for (let line of lines) {
        if (line.startsWith('import ')) {
            importLines.push(line);
            continue;
        }

        const match = line.match(typeRegex);
        if (match) {
            if (inType && currentBlock.length > 0 && currentName) {
                typeBlocks.push({ name: currentName, content: [...currentBlock] });
            }
            currentName = match[4];
            currentBlock = [line];
            inType = true;
        } else if (inType) {
            currentBlock.push(line);
        }
    }

    if (inType && currentBlock.length > 0 && currentName) {
        typeBlocks.push({ name: currentName, content: [...currentBlock] });
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const block of typeBlocks) {
        let classContent = block.content.join('\n');

        classContent = classContent.replace(
            /^\s*(?!public)(\s*)((?:abstract\s+|final\s+)?)(class|interface|enum)\s+(\w+)/m,
            (_, space, modifier, type, name) => `${space}public ${modifier || ''}${type} ${name}`
        );

        const fullContent = [...importLines, '', classContent].join('\n');
        const fileName = path.join(outputDir, `${block.name}.java`);
        fs.writeFileSync(fileName, fullContent, 'utf-8');
        console.log(`Created file: ${fileName}`);
    }
}