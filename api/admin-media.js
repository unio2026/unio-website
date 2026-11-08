import sharp from 'sharp';
import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
export const config={api:{bodyParser:false}};
const MAX=4*1024*1024;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(req.headers.origin&&req.headers.origin!=='https://unio.today')return res.status(403).json({error:'Origin not allowed'});
 const authorization=req.headers.authorization||'';
 if(!authorization.startsWith('Bearer '))return res.status(401).json({error:'Owner sign-in required'});
 try{
  const allowed=await fetch('https://zqllqmjcjozjphixcmvn.supabase.co/functions/v1/social-admin/authorize',{headers:{Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!allowed.ok)return res.status(allowed.status===401?401:403).json({error:'Owner sign-in required'});
  if(!process.env.BLOB_READ_WRITE_TOKEN)return res.status(503).json({error:'Media storage is not configured'});
  if(!['image/jpeg','image/png','image/webp'].includes((req.headers['content-type']||'').split(';')[0]))return res.status(415).json({error:'Use a JPEG, PNG or WebP image'});
  const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>MAX)return res.status(413).json({error:'Maximum upload size is 4 MB'});chunks.push(chunk)}
  if(!total)return res.status(400).json({error:'Choose an image'});
  let jpeg;
  try{jpeg=await sharp(Buffer.concat(chunks),{limitInputPixels:40000000}).rotate().resize({width:1080,height:1350,fit:'contain',background:'#f1f0e9'}).jpeg({quality:90}).toBuffer()}catch{return res.status(415).json({error:'The file could not be decoded as an image'})}
  const blob=await put('social/unio-'+randomUUID()+'.jpg',jpeg,{access:'public',contentType:'image/jpeg',addRandomSuffix:false});
  return res.status(201).json({url:blob.url});
 }catch{return res.status(502).json({error:'Upload service unavailable. Try again later.'})}
}
