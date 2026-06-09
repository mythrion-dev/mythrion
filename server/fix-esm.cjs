const fs = require('fs');
const path = require('path');

function fixEsmImports(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      fixEsmImports(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Fix relative imports without .js extension
      content = content.replace(/from ['"](\.[^'"]*?)(['"];)/g, (match, importPath, quote) => {
        if (!importPath.endsWith('.js') && !importPath.includes('.json')) {
          return `from '${importPath}.js'${quote}`;
        }
        return match;
      });

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  }
}

fixEsmImports(path.join(__dirname, 'dist'));
console.log('ESM imports fixed!');
