// Only the spreadsheet's actual photo files are displayed (read directly from the
// sheet's photo column, same row). No stock/generated replacements or Google Maps links are used as images.
export function placeImages(record){return(record.images||[]).filter(image=>/^https:\/\/lh3\.googleusercontent\.com\/d\/[A-Za-z0-9_-]{20,}=w\d+$/.test(image.src||'')&&/^[A-Za-z0-9_-]{20,}$/.test(image.driveFileId||''))}
export function imageSource(image){try{const url=new URL(image.sourceURL);return['https:','http:'].includes(url.protocol)?url.href:''}catch{return''}}
