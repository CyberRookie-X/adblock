const fs = require('fs');

function writeVarint(buf, value) {
    /**Write a varint to the buffer*/
    while (value > 0x7f) {
        buf.push((value & 0x7f) | 0x80);
        value >>>= 7;
    }
    buf.push(value);
}

function writeString(buf, s) {
    /**Write a length-prefixed string to the buffer*/
    const b = Buffer.from(s, 'utf-8');
    writeVarint(buf, b.length);
    buf.push(...b);
}

function writeDomain(buf, domainType, value) {
    /**Write a Domain message to the buffer following protobuf format*/
    // Create a buffer for the Domain message
    const domainBuf = [];
    
    // Field 1: type (varint)
    writeVarint(domainBuf, (1 << 3) | 0);  // field number 1, wire type 0 (varint)
    writeVarint(domainBuf, domainType);
    
    // Field 2: value (string)
    writeVarint(domainBuf, (2 << 3) | 2);  // field number 2, wire type 2 (length-delimited)
    writeString(domainBuf, value);
    
    // Field 3: attribute (repeated, length-delimited)
    writeVarint(domainBuf, (3 << 3) | 2);  // field number 3, wire type 2 (length-delimited)
    writeVarint(domainBuf, 0);  // Empty list
    
    // Write the complete Domain message to the main buffer
    writeVarint(buf, domainBuf.length);
    buf.push(...domainBuf);
}

function writeGeositeEntry(buf, countryCode, domains) {
    /**Write a GeoSite entry to the buffer*/
    // Create a buffer for the GeoSite entry
    const entryBuf = [];
    
    // Field 1: country_code (string)
    writeVarint(entryBuf, (1 << 3) | 2);  // field number 1, wire type 2 (length-delimited)
    writeString(entryBuf, countryCode);
    
    // Field 2: domains (repeated Domain messages)
    for (const domain of domains) {
        writeVarint(entryBuf, (2 << 3) | 2);  // field number 2, wire type 2 (length-delimited)
        writeDomain(entryBuf, 2, domain);  // Using Domain type for all domains
    }
    
    // Write the complete entry to the main buffer
    writeVarint(buf, entryBuf.length);
    const CHUNK_SIZE = 10000;
    for (let i = 0; i < entryBuf.length; i += CHUNK_SIZE) {
        buf.push(...entryBuf.slice(i, i + CHUNK_SIZE));
    }
}

function main() {
    // 读取cn.txt文件
    const cnDomains = fs.readFileSync('cn.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    // 读取global.txt文件
    const globalDomains = fs.readFileSync('global.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    // 删除已存在的adblock.dat文件
    if (fs.existsSync('adblock.dat')) {
        fs.unlinkSync('adblock.dat');
    }
    
    // 创建adblock.dat文件，严格按照GeoSiteList protobuf结构
    // Create main buffer
    const mainBuf = [];
    
    // Write GeoSiteList with 2 entries
    // Field 1 (repeated GeoSite) for 'CN' entry
    writeVarint(mainBuf, (1 << 3) | 2);  // field number 1, wire type 2 (length-delimited)
    writeGeositeEntry(mainBuf, 'CN', cnDomains);
    
    // Field 1 (repeated GeoSite) for 'NOTCN' entry
    writeVarint(mainBuf, (1 << 3) | 2);  // field number 1, wire type 2 (length-delimited)
    writeGeositeEntry(mainBuf, 'NOTCN', globalDomains);
    
    // Write to file
    fs.writeFileSync('adblock.dat', Buffer.from(mainBuf));
    
    console.log(`Generated adblock.dat with ${cnDomains.length} CN domains and ${globalDomains.length} NOTCN domains`);
}

main();