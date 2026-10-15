// Only the spreadsheet's actual photo files are displayed. No stock/generated
// replacements, expiring download URLs, or Google Maps links are used as images.
export function placeImages(record){return(record.images||[]).filter(image=>/^assets\/places\/[A-Za-z0-9_-]+\.webp$/.test(image.src||'')&&image.width>0&&image.height>0)}
export function imageSource(image){try{const url=new URL(image.sourceURL);return['https:','http:'].includes(url.protocol)?url.href:''}catch{return''}}
