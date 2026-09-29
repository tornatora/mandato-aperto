import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

const PORT=Number(process.env.PORT||8787);
const STORE_BASE=process.env.STORE_BASE||"https://wdinozomvsincosqwueh.supabase.co/functions/v1/meeting-os";
const UI_URI="ui://meeting-os/home-v1.html";
const widgetHtml=readFileSync("public/widget.html","utf8");
const STATUSES=["Da fare","In attesa","Fatto"];

function bearer(req){const h=req.headers.authorization||"";return /^Bearer\s+/i.test(h)?h:""}
async function store(path, token, body={}){
  const r=await fetch(STORE_BASE+path,{method:"POST",headers:{"content-type":"application/json",...(token?{authorization:token}:{})},body:JSON.stringify(body)});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text||"invalid_response"}}
  if(!r.ok){const e=new Error(data?.error||"store_error");e.status=r.status;e.data=data;throw e}
  return data;
}
function challenge(origin){return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", error="invalid_token", error_description="Collega il tuo account Meeting OS"`}
function authError(origin){return{isError:true,content:[{type:"text",text:"Collega il tuo account Meeting OS per continuare."}],_meta:{"mcp/www_authenticate":[challenge(origin)]}}}
const taskSchema=z.object({id:z.string(),meetingId:z.string().nullable(),meetingTitle:z.string().nullable().optional(),title:z.string(),owner:z.string().nullable(),dueDate:z.string().nullable(),status:z.enum(["Da fare","In attesa","Fatto"])});
const meetingSchema=z.object({id:z.string(),title:z.string(),date:z.string().nullable(),participants:z.string().nullable(),summary:z.array(z.string()),decisions:z.array(z.string()),audioName:z.string().nullable(),hasTranscript:z.boolean(),taskCount:z.number()});
const dashSchema={meetings:z.array(meetingSchema),tasks:z.array(taskSchema),stats:z.object({todo:z.number(),waiting:z.number(),meetings:z.number()})};
function uiMeta(){return{ui:{resourceUri:UI_URI,visibility:["model","app"]},"openai/outputTemplate":UI_URI,"openai/widgetAccessible":true}}
function ok(data,text){return{structuredContent:data,content:[{type:"text",text}]}}
function buildServer({token,origin}){
  const s=new McpServer({name:"meeting-os",version:"2.0.0",instructions:"Meeting OS trasforma riunioni in decisioni e azioni. Quando l'utente fornisce o registra un audio in ChatGPT, usa le capacità native di ChatGPT per comprenderlo; poi chiama save_meeting. Non inventare responsabili o scadenze. Sintesi max 5 punti, decisioni reali, task da 0 a 7."});
  registerAppResource(s,"Meeting OS",UI_URI,{},async()=>({contents:[{uri:UI_URI,mimeType:RESOURCE_MIME_TYPE,text:widgetHtml,_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[]}},"openai/ui":{availableDisplayModes:["inline"]},"openai/widgetDescription":"Home mobile di Meeting OS con azioni Registra nuova riunione, Carica audio riunione, attività aperte e ultima riunione."}}]}));
  registerAppTool(s,"get_dashboard",{title:"Apri Meeting OS",description:"Mostra la home Meeting OS dell'utente con attività aperte e riunioni recenti.",inputSchema:{},outputSchema:dashSchema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:"oauth2",scopes:["meeting.read"]}],_meta:uiMeta()},async()=>{try{return ok(await store("/store/dashboard",token,{}),"Meeting OS aggiornato.")}catch(e){if(e.status===401)return authError(origin);throw e}});
  registerAppTool(s,"save_meeting",{title:"Salva riunione",description:"Salva una riunione già analizzata da ChatGPT. Massimo 5 punti di sintesi, massimo 5 decisioni e massimo 7 attività concrete. Non inventare responsabili o scadenze.",inputSchema:{title:z.string().min(1).max(160),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),participants:z.string().max(500).optional(),summary:z.array(z.string().max(500)).max(5),decisions:z.array(z.string().max(500)).max(5),transcript:z.string().optional(),audio_name:z.string().max(300).optional(),tasks:z.array(z.object({title:z.string().min(1).max(300),owner:z.string().max(160).nullable().optional(),due_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),status:z.enum(["Da fare","In attesa","Fatto"]).optional()})).max(7)},outputSchema:dashSchema,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:"oauth2",scopes:["meeting.write"]}],_meta:uiMeta()},async(args)=>{try{return ok(await store("/store/save-meeting",token,args),`Salvata "${args.title}" con ${args.tasks.length} attività.`)}catch(e){if(e.status===401)return authError(origin);throw e}});
  registerAppTool(s,"update_task_status",{title:"Aggiorna attività",description:"Cambia lo stato di un'attività Meeting OS.",inputSchema:{task_id:z.string(),status:z.enum(["Da fare","In attesa","Fatto"])},outputSchema:dashSchema,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:"oauth2",scopes:["meeting.write"]}],_meta:uiMeta()},async(args)=>{try{return ok(await store("/store/update-task",token,args),`Attività aggiornata: ${args.status}.`)}catch(e){if(e.status===401)return authError(origin);throw e}});
  s.registerTool("list_tasks",{title:"Elenca attività",description:"Elenca le attività Meeting OS dell'utente, opzionalmente filtrate per stato.",inputSchema:{status:z.enum(["Da fare","In attesa","Fatto"]).optional()},outputSchema:{tasks:z.array(taskSchema)},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:"oauth2",scopes:["meeting.read"]}]},async(args)=>{try{const d=await store("/store/list-tasks",token,args);return{structuredContent:d,content:[{type:"text",text:d.tasks.length?d.tasks.map(t=>`[${t.status}] ${t.title}`).join("\n"):"Nessuna attività."}]}}catch(e){if(e.status===401)return authError(origin);throw e}});
  s.registerTool("get_meeting",{title:"Apri riunione",description:"Restituisce sintesi, decisioni, trascrizione e attività di una riunione dell'utente.",inputSchema:{meeting_id:z.string()},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},securitySchemes:[{type:"oauth2",scopes:["meeting.read"]}]},async(args)=>{try{const d=await store("/store/get-meeting",token,args);return{structuredContent:d,content:[{type:"text",text:`${d.meeting.title}: ${(d.meeting.summary||[]).join(" · ")}`}]}}catch(e){if(e.status===401)return authError(origin);throw e}});
  return s;
}

const httpServer=createServer(async(req,res)=>{
  if(!req.url){res.writeHead(400).end("Missing URL");return}
  const origin=`https://${req.headers.host}`;
  const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
  if(req.method==="GET"&&url.pathname==="/"){res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({ok:true,name:"Meeting OS MCP",mcp:"/mcp"}));return}
  if(req.method==="GET"&&url.pathname==="/health"){res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({ok:true}));return}
  if(req.method==="GET"&&url.pathname==="/.well-known/oauth-protected-resource"){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"}).end(JSON.stringify({resource:origin+"/mcp",authorization_servers:[STORE_BASE],scopes_supported:["meeting.read","meeting.write"],bearer_methods_supported:["header"]}));return}
  if(req.method==="OPTIONS"&&url.pathname==="/mcp"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, GET, DELETE, OPTIONS","Access-Control-Allow-Headers":"authorization, content-type, mcp-session-id","Access-Control-Expose-Headers":"Mcp-Session-Id"});res.end();return}
  if(url.pathname==="/mcp"&&["POST","GET","DELETE"].includes(req.method||"")){
    res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Expose-Headers","Mcp-Session-Id");
    const s=buildServer({token:bearer(req),origin});
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on("close",()=>{transport.close();s.close()});
    try{await s.connect(transport);await transport.handleRequest(req,res)}catch(e){console.error(e);if(!res.headersSent)res.writeHead(500).end("Internal server error")}
    return;
  }
  res.writeHead(404).end("Not Found");
});
httpServer.listen(PORT,"0.0.0.0",()=>console.log(`Meeting OS listening on :${PORT}`));
