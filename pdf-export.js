/* Private, dependency-free Arabic PDF export.
 * Renders report text using the device's Arabic-capable Canvas font and packages
 * JPEG page images into an A4 PDF. No document content leaves the device.
 * The PDF is image-based: text is visually readable but not text-selectable.
 */
(function(){
'use strict';
const PW=794,PH=1123,SCALE=1.65,RIGHT=PW-43,LEFT=43,BOTTOM=PH-59;
const POINT_W=595.28,POINT_H=841.89;
const FACE="'Tahoma','Arial','Noto Naskh Arabic',sans-serif";
const enc=new TextEncoder();
const plain=x=>String(x??'').replace(/\u0000/g,'').trim();
const wText=(ctx,text,maxWidth)=>{
 const lines=[];
 const paragraphs=plain(text).replace(/\r\n?/g,'\n').split('\n');
 for(const paragraph of paragraphs){
   const words=paragraph.split(/\s+/).filter(Boolean);
   if(!words.length){lines.push('');continue;}
   let cur='';
   for(const word of words){
     const candidate=cur?cur+' '+word:word;
     if(ctx.measureText(candidate).width<=maxWidth){cur=candidate;continue}
     if(cur){lines.push(cur);cur=''}
     // Ensure even very long unbroken words can wrap.
     let part='';
     for(const char of Array.from(word)){
       if(part&&ctx.measureText(part+char).width>maxWidth){lines.push(part);part=''}
       part+=char;
     }
     cur=part;
   }
   lines.push(cur);
 }
 return lines;
};
function pdfBlob(images){
 if(!images.length)throw Error('تعذر إنشاء صفحات التقرير.');
 let output=[],bytes=0,offsets=[];
 const add=chunk=>{output.push(chunk);bytes+=chunk.byteLength};
 const txt=s=>add(enc.encode(s));
 const object=(id,body)=>{offsets[id]=bytes;txt(id+' 0 obj\n');body();txt('\nendobj\n')};
 txt('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 const kids=images.map((_,i)=>(4+i*3)+' 0 R').join(' ');
 object(1,()=>txt('<< /Type /Catalog /Pages 2 0 R >>'));
 object(2,()=>txt('<< /Type /Pages /Kids ['+kids+'] /Count '+images.length+' >>'));
 images.forEach((image,i)=>{
   const base=3+i*3;
   object(base,()=>{
     txt('<< /Type /XObject /Subtype /Image /Width '+image.width+
       ' /Height '+image.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8'+
       ' /Filter /DCTDecode /Length '+image.jpeg.byteLength+' >>\nstream\n');
     add(image.jpeg);
     txt('\nendstream');
   });
   object(base+1,()=>txt('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+POINT_W+' '+POINT_H+
     '] /Resources << /XObject << /Im0 '+base+' 0 R >> >> /Contents '+(base+2)+' 0 R >>'));
   const stream='q\n'+POINT_W+' 0 0 '+POINT_H+' 0 0 cm\n/Im0 Do\nQ\n';
   object(base+2,()=>txt('<< /Length '+enc.encode(stream).byteLength+' >>\nstream\n'+stream+'endstream'));
 });
 const start=bytes, size=images.length*3+3;
 txt('xref\n0 '+size+'\n0000000000 65535 f \n');
 for(let i=1;i<size;i++)txt(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 txt('trailer\n<< /Root 1 0 R /Size '+size+' >>\nstartxref\n'+start+'\n%%EOF\n');
 return new Blob(output,{type:'application/pdf'});
}
function generate(report){
 if(!report||!Array.isArray(report.rows)||!report.school)
   throw Error('بيانات التقرير غير صالحة.');
 if(report.rows.length>3000)
   throw Error('التقرير كبير جدًا. قسّميه إلى فترات أقصر قبل التصدير.');
 const canvas=document.createElement('canvas');
 canvas.width=Math.round(PW*SCALE);canvas.height=Math.round(PH*SCALE);
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)throw Error('متصفح الجهاز لا يدعم إنشاء PDF بهذه الطريقة.');
 ctx.scale(SCALE,SCALE);
 ctx.direction='rtl';ctx.textAlign='right';ctx.textBaseline='alphabetic';
 const images=[];
 let y=0,pageNo=0;
 const font=(size,weight='normal')=>{ctx.font=weight+' '+size+'px '+FACE};
 const line=(text,size=14,color='#27334a',weight='normal',height=21)=>{
   font(size,weight);ctx.fillStyle=color;
   for(const segment of wText(ctx,text,RIGHT-LEFT-25)){
     if(y+height>BOTTOM)nextPage(true);
     ctx.fillText(segment||' ',RIGHT,y);
     y+=height;
   }
 };
 const finish=()=>{
   if(!pageNo)return;
   ctx.strokeStyle='#d3d8e3';ctx.beginPath();ctx.moveTo(LEFT,PH-47);ctx.lineTo(RIGHT,PH-47);ctx.stroke();
   font(11);ctx.fillStyle='#52607b';
   ctx.fillText('صفحة '+pageNo,RIGHT,PH-28);
   ctx.textAlign='left';ctx.direction='ltr';
   ctx.fillText('student-guidance2',LEFT,PH-28);
   ctx.textAlign='right';ctx.direction='rtl';
   const uri=canvas.toDataURL('image/jpeg',0.87);
   const b64=uri.slice(uri.indexOf(',')+1),binary=atob(b64);
   const jpeg=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)jpeg[i]=binary.charCodeAt(i);
   images.push({jpeg,width:canvas.width,height:canvas.height});
 };
 const nextPage=(continuing=false)=>{
   if(pageNo)finish();
   pageNo++;
   ctx.fillStyle='#fff';ctx.fillRect(0,0,PW,PH);
   ctx.fillStyle='#111e3a';ctx.fillRect(0,0,PW,15);
   ctx.fillStyle='#c4a265';ctx.fillRect(RIGHT-84,37,84,3);
   font(23,'bold');ctx.fillStyle='#182847';
   ctx.fillText('تقرير الموجّهة الطلابية',RIGHT,70);
   font(14);ctx.fillStyle='#304061';
   ctx.fillText(plain(report.school),RIGHT,96);
   font(11);ctx.fillStyle='#647089';
   ctx.fillText('تاريخ إعداد التقرير: '+plain(report.date),RIGHT,118);
   ctx.textAlign='left';ctx.direction='ltr';
   ctx.fillText(report.showNames?'CONFIDENTIAL — بيانات اسمية':'PRIVATE — للاستخدام المصرح به',LEFT,115);
   ctx.direction='rtl';ctx.textAlign='right';
   ctx.strokeStyle='#e0e4ec';ctx.beginPath();ctx.moveTo(LEFT,131);ctx.lineTo(RIGHT,131);ctx.stroke();
   y=155;
   if(continuing){line('تابع التقرير',12,'#6b7790','bold',22);y+=4}
 };
 const label=(text)=>{
   if(y+43>BOTTOM)nextPage(true);
   font(13,'bold');ctx.fillStyle='#3f5374';ctx.fillText(plain(text),RIGHT,y);y+=19;
 };
 const field=(labelText,value,blank)=>{
   label(labelText);
   line(plain(value)||(blank||'—'),14,'#172540','normal',21);
   y+=6;
 };
 nextPage();
 const rows=report.rows;
 const opened=rows.filter(r=>r.status==='مفتوحة').length;
 const closed=rows.filter(r=>r.status==='مغلقة').length;
 const unknown=rows.length-opened-closed;
 line('عدد السجلات: '+rows.length+'   |   مفتوحة: '+opened+
   '   |   مغلقة: '+closed+'   |   لم تُوثّق حالتها: '+unknown,13,'#344463','bold',23);
 y+=12;
 if(!rows.length)line('لا توجد سجلات مطابقة للاختيارات.',16,'#4c5b74','normal',30);
 for(let i=0;i<rows.length;i++){
   const r=rows[i];
   if(y+115>BOTTOM)nextPage();
   // Card separator and heading — any long field can continue on next page.
   ctx.fillStyle='#f1f4f9';ctx.fillRect(LEFT-6,y-17,RIGHT-LEFT+13,30);
   font(15,'bold');ctx.fillStyle='#17284a';
   ctx.fillText((i+1)+'. '+plain(r.type||'حالة'),RIGHT-7,y+4);
   y+=34;
   line('التاريخ: '+plain(r.date||'—')+'   |   حالة المتابعة: '+plain(r.status||'لم تُوثّق'),12,'#536281','normal',20);
   if(report.showNames)field('الطالبة',r.studentName,'غير مذكورة');
   field('موضوع الحالة',r.subject,'لم يُسجل الموضوع');
   if(plain(r.details))field('التفاصيل والملاحظات',r.details);
   field('الإجراء المتخذ أو المدون',r.action,'لم يُدوّن إجراء');
   y+=6;
   if(y+23<BOTTOM){ctx.strokeStyle='#e1e6ed';ctx.beginPath();ctx.moveTo(LEFT,y-11);ctx.lineTo(RIGHT,y-11);ctx.stroke();}
 }
 finish();
 return pdfBlob(images);
}
window.GuidancePdf={generate};
})();