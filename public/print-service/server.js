const os = require("os");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { exec, execSync } = require("child_process");

const VERSION = "1.1.2";
const platform = os.platform();
const INSTALL_DIR = path.join(os.homedir(), ".logirapid-print-service");
const CONFIG_PATH = path.join(INSTALL_DIR, "config.json");
const HISTORY_PATH = path.join(INSTALL_DIR, "history.json");
const UI_PORT = 9100;

// ─── Config ───

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (raw.token && !raw.tokens) {
      raw.tokens = [{ token: raw.token, name: raw.name || "Departamento" }];
      delete raw.token;
      delete raw.name;
      saveConfig(raw);
    }
    return raw;
  } catch {
    return null;
  }
}

function saveConfig(config) {
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

// ─── Job History ───

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  // Keep last 200 entries
  const trimmed = history.slice(-200);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(trimmed, null, 2), "utf8");
}

function addToHistory(job, status, errorMessage) {
  const history = loadHistory();
  history.push({
    id: job.id,
    document_type: job.document_type || job.label_type,
    label_id: job.label_id,
    format: job.format,
    printer: job.printer_name || "(default)",
    copies: job.copies || 1,
    status,
    error: errorMessage || null,
    timestamp: new Date().toISOString(),
  });
  saveHistory(history);
}

// ─── Helpers ───

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

function getTempFile(ext) {
  return path.join(os.tmpdir(), `logirapid-label-${Date.now()}.${ext}`);
}

// ─── Auto-start management ───

function isAutoStartEnabled() {
  if (platform === "darwin") {
    const plist = path.join(os.homedir(), "Library/LaunchAgents/com.logirapid.print-service.plist");
    return fs.existsSync(plist);
  } else if (platform === "win32") {
    const shortcut = path.join(process.env.APPDATA || "", "Microsoft/Windows/Start Menu/Programs/Startup/LogiRapid Print Service.lnk");
    return fs.existsSync(shortcut);
  }
  return false;
}

function setAutoStart(enabled) {
  if (platform === "darwin") {
    const plist = path.join(os.homedir(), "Library/LaunchAgents/com.logirapid.print-service.plist");
    if (enabled) {
      const nodePath = process.execPath;
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.logirapid.print-service</string>
    <key>ProgramArguments</key><array><string>${nodePath}</string><string>${INSTALL_DIR}/server.js</string></array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>${INSTALL_DIR}/print-service.log</string>
    <key>StandardErrorPath</key><string>${INSTALL_DIR}/print-service-error.log</string>
    <key>WorkingDirectory</key><string>${INSTALL_DIR}</string>
</dict>
</plist>`;
      fs.mkdirSync(path.dirname(plist), { recursive: true });
      fs.writeFileSync(plist, content);
      try { execSync(`launchctl load "${plist}" 2>/dev/null`); } catch {}
    } else {
      try { execSync(`launchctl unload "${plist}" 2>/dev/null`); } catch {}
      try { fs.unlinkSync(plist); } catch {}
    }
  } else if (platform === "win32") {
    const shortcut = path.join(process.env.APPDATA || "", "Microsoft/Windows/Start Menu/Programs/Startup/LogiRapid Print Service.lnk");
    if (enabled) {
      const vbs = path.join(os.tmpdir(), "create-shortcut.vbs");
      const startBat = path.join(INSTALL_DIR, "start.bat");
      fs.writeFileSync(vbs, `Set s=CreateObject("WScript.Shell").CreateShortcut("${shortcut}")\ns.TargetPath="cmd.exe"\ns.Arguments="/c ""${startBat}"""\ns.WorkingDirectory="${INSTALL_DIR}"\ns.WindowStyle=7\ns.Save`);
      try { execSync(`cscript //nologo "${vbs}"`); } catch {}
      try { fs.unlinkSync(vbs); } catch {}
    } else {
      try { fs.unlinkSync(shortcut); } catch {}
    }
  }
}

// ─── List printers ───

let cachedPrinters = [];

async function listPrinters() {
  if (platform === "win32") cachedPrinters = await listPrintersWindows();
  else if (platform === "darwin") cachedPrinters = await listPrintersMac();
  else cachedPrinters = [];
  return cachedPrinters;
}

// Run a PowerShell script via temp file (avoids cmd.exe quoting hell)
function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const tmpPs1 = path.join(os.tmpdir(), `logirapid-ps-${Date.now()}.ps1`);
    fs.writeFileSync(tmpPs1, script, "utf8");
    exec(
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1}"`,
      { encoding: "utf8", maxBuffer: 5 * 1024 * 1024, timeout: 15000 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpPs1); } catch {}
        if (err) return reject(new Error((stderr || err.message).trim()));
        resolve((stdout || "").trim());
      }
    );
  });
}

async function listPrintersWindows() {
  // Method 1: Get-CimInstance (works on all Windows editions including Home)
  try {
    const raw = await runPowerShell(
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' +
      'Get-CimInstance -ClassName Win32_Printer | Select-Object Name, PrinterStatus, Default | ConvertTo-Json -Compress'
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      console.log(`  [Printers] Get-CimInstance found ${arr.length} printer(s)`);
      return arr.map((p) => ({
        name: p.Name,
        isDefault: p.Default || false,
        status: p.PrinterStatus === 0 || p.PrinterStatus === 3 ? "idle" : "error",
      }));
    }
  } catch (e) {
    console.log("  [Printers] Get-CimInstance failed:", e.message);
  }

  // Method 2: Get-Printer (Pro/Enterprise only)
  try {
    const raw = await runPowerShell(
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' +
      'Get-Printer | Select-Object Name, PrinterStatus, IsDefault | ConvertTo-Json -Compress'
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      console.log(`  [Printers] Get-Printer found ${arr.length} printer(s)`);
      return arr.map((p) => ({
        name: p.Name,
        isDefault: p.IsDefault || false,
        status: p.PrinterStatus === 0 || p.PrinterStatus === "Normal" ? "idle" : "error",
      }));
    }
  } catch (e) {
    console.log("  [Printers] Get-Printer failed:", e.message);
  }

  // Method 3: .NET System.Drawing.Printing (works even without WMI/CIM)
  try {
    const raw = await runPowerShell(
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n' +
      'Add-Type -AssemblyName System.Drawing\n' +
      '$result = @()\n' +
      'foreach ($name in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) {\n' +
      '  $s = New-Object System.Drawing.Printing.PrinterSettings\n' +
      '  $s.PrinterName = $name\n' +
      '  $result += [PSCustomObject]@{ Name = $name; IsDefault = $s.IsDefaultPrinter; IsValid = $s.IsValid }\n' +
      '}\n' +
      '$result | ConvertTo-Json -Compress'
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      console.log(`  [Printers] .NET found ${arr.length} printer(s)`);
      return arr.filter((p) => p.IsValid).map((p) => ({
        name: p.Name,
        isDefault: p.IsDefault || false,
        status: "idle",
      }));
    }
  } catch (e) {
    console.log("  [Printers] .NET fallback failed:", e.message);
  }

  // Method 4: wmic legacy (very old Windows)
  try {
    const raw = await execAsync("wmic printer get Name,Default,PrinterStatus /format:csv");
    const lines = raw.split("\n").filter((l) => l.trim() && !l.startsWith("Node"));
    if (lines.length > 1) {
      const header = lines[0].split(",").map((h) => h.trim());
      const nameIdx = header.indexOf("Name");
      const defaultIdx = header.indexOf("Default");
      return lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
          name: nameIdx >= 0 ? cols[nameIdx] : cols[2] || "Unknown",
          isDefault: defaultIdx >= 0 ? cols[defaultIdx] === "TRUE" : false,
          status: "idle",
        };
      }).filter((p) => p.name && p.name !== "Unknown");
    }
  } catch (e) {
    console.log("  [Printers] WMIC failed:", e.message);
  }

  console.log("  [Printers] WARNING: All detection methods failed!");
  return [];
}

async function listPrintersMac() {
  try {
    // lpstat -e lists printer names (locale-independent)
    const raw = await execAsync("lpstat -e 2>/dev/null");
    const names = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) return [];

    // Get default printer (extract last word, works in any locale)
    const defaultRaw = await execAsync("lpstat -d 2>/dev/null").catch(() => "");
    const defParts = defaultRaw.split(/:\s*/);
    const def = (defParts[defParts.length - 1] || "").trim();

    // Get status info (locale-dependent but we just check for keywords)
    const statusRaw = await execAsync("lpstat -p 2>/dev/null").catch(() => "");

    // statusRaw may have multiple lines per printer, so grab all lines between printer entries
    const statusLines = statusRaw.split("\n");

    return names.map((name) => {
      // Find all lines related to this printer
      const related = statusLines.filter((l) => l.includes(name) || (l.startsWith("\t") && statusLines[statusLines.indexOf(l) - 1]?.includes(name)));
      const block = related.join(" ").toLowerCase();
      const isOffline = block.includes("no tiene conexión") || block.includes("not connected") || block.includes("offline");
      const isPrinting = !isOffline && (block.includes("printing") || block.includes("imprimiendo"));
      const isIdle = block.includes("idle") || block.includes("inactiva");
      return {
        name,
        isDefault: name === def,
        status: isOffline ? "offline" : isPrinting ? "printing" : "idle",
      };
    });
  } catch { return []; }
}

// ─── Print functions ───

async function printRawBytes(printerName, rawData, copies = 1) {
  const tmpFile = getTempFile("raw");
  const data = new Array(copies).fill(rawData).join("\n");
  fs.writeFileSync(tmpFile, data, "binary");
  try {
    if (platform === "win32") {
      await execAsync(`powershell -Command "Get-Content '${tmpFile}' | Out-Printer ${printerName ? "'" + printerName + "'" : ""}"`);
    } else {
      await execAsync(`lpr ${printerName ? '-P "' + printerName + '"' : ""} -o raw "${tmpFile}"`);
    }
  } finally { try { fs.unlinkSync(tmpFile); } catch {} }
}

async function printPDF(printerName, base64Data, copies = 1) {
  const tmpFile = getTempFile("pdf");
  fs.writeFileSync(tmpFile, Buffer.from(base64Data, "base64"));
  try {
    if (platform === "win32") {
      try {
        const p = require("pdf-to-printer");
        const o = { copies };
        if (printerName) o.printer = printerName;
        await p.print(tmpFile, o);
      } catch { await execAsync(`powershell -Command "Start-Process -FilePath '${tmpFile}' -Verb Print"`); }
    } else {
      await execAsync(`lpr ${printerName ? '-P "' + printerName + '"' : ""} -# ${copies} "${tmpFile}"`);
    }
  } finally { setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 5000); }
}

// ─── Process job ───

async function checkPrinterOnline(printerName) {
  if (!printerName || platform === "win32") return true;
  try {
    const raw = await execAsync(`lpstat -p "${printerName}" 2>/dev/null`);
    const lower = raw.toLowerCase();
    if (lower.includes("no tiene conexión") || lower.includes("not connected") || lower.includes("offline")) {
      return false;
    }
    return true;
  } catch { return true; }
}

async function processJob(job, server, token) {
  try {
    // Validate job data
    if (!job.data) throw new Error("Job sin datos para imprimir");
    if (!job.format) throw new Error("Job sin formato especificado");

    // Check printer is online before sending
    const isOnline = await checkPrinterOnline(job.printer_name);
    if (!isOnline) {
      throw new Error(`Impresora "${job.printer_name}" sin conexion`);
    }

    if (job.format === "zpl" || job.format === "escpos" || job.format === "tspl") {
      await printRawBytes(job.printer_name, job.data, job.copies || 1);
    } else if (job.format === "pdf") {
      await printPDF(job.printer_name, job.data, job.copies || 1);
    } else {
      throw new Error(`Formato no soportado: ${job.format}`);
    }

    await fetch(`${server}/api/print-agent`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, job_id: job.id, status: "done" }),
    });
    addToHistory(job, "done");
    console.log(`  [OK] Job ${job.id.slice(0, 8)} impreso (${job.format})`);
  } catch (err) {
    await fetch(`${server}/api/print-agent`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, job_id: job.id, status: "error", error_message: err.message }),
    });
    addToHistory(job, "error", err.message);
    console.error(`  [ERROR] Job ${job.id.slice(0, 8)}: ${err.message}`);
  }
}

// ─── Poll ───

let lastPollStatus = {};

async function pollToken(server, tokenEntry, printers) {
  try {
    const params = new URLSearchParams({ token: tokenEntry.token, version: VERSION, printers: JSON.stringify(printers) });
    const res = await fetch(`${server}/api/print-agent?${params}`);
    if (!res.ok) {
      lastPollStatus[tokenEntry.token] = { online: false, error: `HTTP ${res.status}` };
      return;
    }
    const data = await res.json();
    lastPollStatus[tokenEntry.token] = { online: true, service_name: data.service_name, last_poll: new Date().toISOString() };
    for (const job of (data.jobs || [])) await processJob(job, server, tokenEntry.token);
  } catch (err) {
    lastPollStatus[tokenEntry.token] = { online: false, error: err.message };
  }
}

async function pollAll(config) {
  const printers = await listPrinters();
  for (const t of config.tokens) await pollToken(config.server, t, printers);
}

// ─── Auto-update ───

let updateStatus = { available: false, version: null, updating: false, error: null, lastCheck: null };

async function checkForUpdate(config) {
  try {
    const res = await fetch(`${config.server}/api/print-agent/version`);
    if (!res.ok) return null;
    const data = await res.json();
    updateStatus.lastCheck = new Date().toISOString();
    if (data.version && data.version !== VERSION) {
      updateStatus.available = true;
      updateStatus.version = data.version;
      return data;
    }
    updateStatus.available = false;
    updateStatus.version = null;
    return null;
  } catch { return null; }
}

async function performUpdate(config) {
  if (updateStatus.updating) return { success: false, error: "Actualizacion en curso" };
  updateStatus.updating = true;
  updateStatus.error = null;

  try {
    const serverUrl = config.server;
    const installDir = INSTALL_DIR;

    // 1. Download new server.js
    console.log("  [Update] Descargando nueva version...");
    let newCode = null;
    try {
      const res = await fetch(`${serverUrl}/print-service/server.js`);
      if (res.ok) newCode = await res.text();
    } catch {}
    if (!newCode) {
      const res = await fetch(`${serverUrl}/api/print-agent/install/files?name=server.js`);
      if (res.ok) newCode = await res.text();
    }
    if (!newCode) throw new Error("No se pudo descargar server.js");

    // 2. Download new package.json
    let newPkg = null;
    try {
      const res = await fetch(`${serverUrl}/print-service/package.json`);
      if (res.ok) newPkg = await res.text();
    } catch {}
    if (!newPkg) {
      const res = await fetch(`${serverUrl}/api/print-agent/install/files?name=package.json`);
      if (res.ok) newPkg = await res.text();
    }

    // 3. Backup current files
    const serverPath = path.join(installDir, "server.js");
    const backupPath = path.join(installDir, "server.js.bak");
    if (fs.existsSync(serverPath)) {
      fs.copyFileSync(serverPath, backupPath);
    }

    // 4. Write new files
    fs.writeFileSync(serverPath, newCode, "utf8");
    if (newPkg) {
      fs.writeFileSync(path.join(installDir, "package.json"), newPkg, "utf8");
    }
    console.log("  [Update] Archivos actualizados");

    // 5. Install dependencies if package.json changed
    if (newPkg) {
      try {
        console.log("  [Update] Instalando dependencias...");
        execSync("npm install --omit=dev --silent", { cwd: installDir, stdio: "ignore", timeout: 30000 });
      } catch {}
    }

    console.log("  [Update] Reiniciando servicio...");
    updateStatus.updating = false;
    updateStatus.available = false;

    // 6. Restart: spawn detached child process BEFORE exiting
    const nodePath = process.execPath;
    const serverFile = path.join(installDir, "server.js");

    // Small delay to allow HTTP response to be sent
    setTimeout(() => {
      try {
        const child = require("child_process").spawn(nodePath, [serverFile], {
          cwd: installDir,
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.unref();
        console.log("  [Update] Nuevo proceso iniciado (PID: " + child.pid + ")");
      } catch (spawnErr) {
        console.error("  [Update] Error al iniciar nuevo proceso:", spawnErr.message);
        // Fallback: on Mac use launchctl, on Windows create a scheduled task
        if (platform === "darwin") {
          try { execSync('launchctl kickstart -k gui/$(id -u)/com.logirapid.print-service 2>/dev/null', { stdio: "ignore" }); } catch {}
        }
      }
      // Exit current process after spawn
      setTimeout(() => process.exit(0), 300);
    }, 500);

    return { success: true, version: updateStatus.version };
  } catch (err) {
    // Restore backup if exists
    const serverPath = path.join(INSTALL_DIR, "server.js");
    const backupPath = path.join(INSTALL_DIR, "server.js.bak");
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, serverPath);
      console.log("  [Update] Restaurado desde backup");
    }
    updateStatus.updating = false;
    updateStatus.error = err.message;
    console.error("  [Update] Error:", err.message);
    return { success: false, error: err.message };
  }
}

// ─── Web UI ───

function getUIHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LogiRapid Print Service</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1117; color: #e4e4e7; min-height: 100vh; }
  .container { max-width: 720px; margin: 0 auto; padding: 20px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #27272a; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header .version { font-size: 11px; color: #71717a; background: #27272a; padding: 2px 8px; border-radius: 99px; }
  .header .status { margin-left: auto; font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.green { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .dot.red { background: #ef4444; }
  .section { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .section h2 { font-size: 13px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .warehouse { display: flex; align-items: center; gap: 10px; padding: 10px; background: #27272a; border-radius: 8px; margin-bottom: 8px; }
  .warehouse .info { flex: 1; }
  .warehouse .name { font-size: 14px; font-weight: 600; }
  .warehouse .token { font-size: 10px; color: #71717a; font-family: monospace; }
  .warehouse .status-badge { font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
  .warehouse .status-badge.online { background: rgba(34,197,94,0.15); color: #22c55e; }
  .warehouse .status-badge.offline { background: rgba(239,68,68,0.15); color: #ef4444; }
  .btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #27272a; background: #27272a; color: #e4e4e7; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .btn:hover { background: #3f3f46; }
  .btn.primary { background: #0580f0; border-color: #0580f0; color: white; }
  .btn.primary:hover { background: #0460c0; }
  .btn.danger { color: #ef4444; }
  .btn.danger:hover { background: #7f1d1d30; }
  .btn.small { padding: 4px 10px; font-size: 11px; }
  .printer { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #27272a; border-radius: 8px; margin-bottom: 6px; }
  .printer .name { font-size: 13px; flex: 1; }
  .printer .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #3f3f46; color: #a1a1aa; }
  .printer .badge.default { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .job { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #27272a; border-radius: 8px; margin-bottom: 6px; font-size: 12px; }
  .job .id { font-family: monospace; color: #71717a; width: 70px; }
  .job .type { color: #a1a1aa; width: 50px; }
  .job .format { font-family: monospace; width: 45px; color: #0580f0; }
  .job .time { color: #71717a; margin-left: auto; font-size: 11px; }
  .job .result { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .job .result.done { background: rgba(34,197,94,0.15); color: #22c55e; }
  .job .result.error { background: rgba(239,68,68,0.15); color: #ef4444; }
  .toggle { position: relative; width: 40px; height: 22px; background: #3f3f46; border-radius: 99px; cursor: pointer; transition: 0.2s; }
  .toggle.on { background: #0580f0; }
  .toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: 0.2s; }
  .toggle.on::after { left: 21px; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
  .row label { font-size: 13px; }
  .empty { text-align: center; padding: 20px; color: #52525b; font-size: 13px; }
  .input-row { display: flex; gap: 8px; margin-top: 8px; }
  .input-row input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #27272a; background: #27272a; color: #e4e4e7; font-size: 13px; font-family: monospace; outline: none; }
  .input-row input:focus { border-color: #0580f0; }
  .msg { font-size: 12px; padding: 8px; border-radius: 8px; margin-top: 8px; }
  .msg.success { background: rgba(34,197,94,0.1); color: #22c55e; }
  .msg.error { background: rgba(239,68,68,0.1); color: #ef4444; }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0580f0" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    <h1>LogiRapid Print Service</h1>
    <span class="version">v${VERSION}</span>
    <div class="status"><div class="dot green"></div> Activo</div>
  </div>

  <!-- Departamentos -->
  <div class="section">
    <h2>Departamentos Emparejados</h2>
    <div id="warehouses"></div>
    <div class="input-row" id="add-token-row" style="display:none">
      <input type="text" id="new-token" placeholder="Pega el token del nuevo departamento..." />
      <button class="btn primary small" onclick="addToken()">Agregar</button>
      <button class="btn small" onclick="toggleAddToken(false)">Cancelar</button>
    </div>
    <div id="add-msg"></div>
    <div class="actions">
      <button class="btn primary" onclick="toggleAddToken(true)">+ Agregar Departamento</button>
    </div>
  </div>

  <!-- Printers -->
  <div class="section">
    <h2>Impresoras del Sistema</h2>
    <div id="printers"></div>
    <div class="actions">
      <button class="btn small" onclick="refreshPrinters()">Actualizar</button>
    </div>
  </div>

  <!-- History -->
  <div class="section">
    <h2>Historial de Impresion</h2>
    <div id="history"></div>
  </div>

  <!-- Update -->
  <div class="section" id="update-section">
    <h2>Actualizacion</h2>
    <div class="row">
      <label>Version actual</label>
      <span style="font-size:12px;color:#71717a">v${VERSION}</span>
    </div>
    <div id="update-status"></div>
    <div class="actions">
      <button class="btn small" id="check-update-btn" onclick="checkUpdate()">Buscar actualizacion</button>
    </div>
  </div>

  <!-- Settings -->
  <div class="section">
    <h2>Configuracion</h2>
    <div class="row">
      <label>Inicio automatico</label>
      <div class="toggle" id="autostart-toggle" onclick="toggleAutoStart()"></div>
    </div>
    <div class="row">
      <label>Plataforma</label>
      <span style="font-size:12px;color:#71717a">${platform} - ${os.arch()}</span>
    </div>
  </div>
</div>

<script>
function toggleAddToken(show) {
  document.getElementById('add-token-row').style.display = show ? 'flex' : 'none';
  if (show) document.getElementById('new-token').focus();
  document.getElementById('add-msg').innerHTML = '';
}

async function addToken() {
  const token = document.getElementById('new-token').value.trim();
  if (!token) return;
  const res = await fetch('/api/add-token', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token}) });
  const data = await res.json();
  const msg = document.getElementById('add-msg');
  if (data.success) {
    msg.innerHTML = '<div class="msg success">Departamento agregado: ' + data.name + '</div>';
    document.getElementById('new-token').value = '';
    toggleAddToken(false);
    refresh();
  } else {
    msg.innerHTML = '<div class="msg error">' + data.error + '</div>';
  }
}

async function removeToken(token) {
  if (!confirm('Quitar este departamento?')) return;
  await fetch('/api/remove-token', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token}) });
  refresh();
}

async function toggleAutoStart() {
  const res = await fetch('/api/autostart', { method: 'POST' });
  const data = await res.json();
  updateAutoStartUI(data.enabled);
}

function updateAutoStartUI(enabled) {
  const el = document.getElementById('autostart-toggle');
  el.className = 'toggle' + (enabled ? ' on' : '');
}

async function refreshPrinters() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Buscando...';
  const res = await fetch('/api/printers');
  const data = await res.json();
  renderPrinters(data.printers);
  btn.textContent = data.printers.length ? data.printers.length + ' impresora(s) encontrada(s)' : 'Sin impresoras';
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Actualizar'; }, 2000);
}

function renderPrinters(printers) {
  const el = document.getElementById('printers');
  if (!printers.length) { el.innerHTML = '<div class="empty">No se detectaron impresoras</div>'; return; }
  el.innerHTML = printers.map(p => '<div class="printer"><span class="name">' + p.name + '</span>' +
    (p.isDefault ? '<span class="badge default">Default</span>' : '') +
    '<span class="badge">' + p.status + '</span></div>').join('');
}

function renderWarehouses(tokens, pollStatus) {
  const el = document.getElementById('warehouses');
  if (!tokens.length) { el.innerHTML = '<div class="empty">No hay departamentos emparejados</div>'; return; }
  el.innerHTML = tokens.map(t => {
    const s = pollStatus[t.token] || {};
    const online = s.online;
    return '<div class="warehouse"><div class="info"><div class="name">' + t.name + '</div><div class="token">' + t.token + '</div></div>' +
      '<span class="status-badge ' + (online ? 'online' : 'offline') + '">' + (online ? 'Online' : 'Offline') + '</span>' +
      '<button class="btn danger small" onclick="removeToken(\\''+t.token+'\\')">Quitar</button></div>';
  }).join('');
}

function renderHistory(jobs) {
  const el = document.getElementById('history');
  if (!jobs.length) { el.innerHTML = '<div class="empty">Sin impresiones recientes</div>'; return; }
  const statusLabels = { done: 'Impreso', error: 'Error', pending: 'Pendiente', printing: 'Imprimiendo' };
  el.innerHTML = jobs.slice().reverse().slice(0, 50).map(j => {
    const time = new Date(j.timestamp).toLocaleTimeString();
    const typeLabel = j.document_type || j.label_type || 'doc';
    const statusLabel = statusLabels[j.status] || j.status;
    const errorTip = j.error ? ' title="' + j.error.replace(/"/g, '&quot;') + '"' : '';
    return '<div class="job"><span class="id">' + j.id.slice(0,8) + '</span><span class="type">' + typeLabel + '</span>' +
      '<span class="format">' + j.format.toUpperCase() + '</span><span class="result ' + j.status + '"' + errorTip + '>' + statusLabel + '</span>' +
      '<span class="time">' + time + '</span></div>';
  }).join('');
}

async function checkUpdate() {
  const btn = document.getElementById('check-update-btn');
  const el = document.getElementById('update-status');
  btn.disabled = true;
  btn.textContent = 'Buscando...';
  el.innerHTML = '';
  try {
    const res = await fetch('/api/check-update');
    const data = await res.json();
    if (data.available) {
      el.innerHTML = '<div class="msg success" style="display:flex;align-items:center;justify-content:space-between">' +
        '<span>Nueva version disponible: <b>v' + data.version + '</b></span>' +
        '<button class="btn primary small" onclick="doUpdate()">Actualizar ahora</button></div>';
      btn.textContent = 'Nueva version: v' + data.version;
    } else {
      el.innerHTML = '<div class="msg success">Estas al dia (v${VERSION})</div>';
      btn.textContent = 'Buscar actualizacion';
      setTimeout(() => { el.innerHTML = ''; }, 3000);
    }
  } catch (e) {
    el.innerHTML = '<div class="msg error">Error al buscar: ' + e.message + '</div>';
    btn.textContent = 'Buscar actualizacion';
  }
  btn.disabled = false;
}

async function doUpdate() {
  const el = document.getElementById('update-status');
  el.innerHTML = '<div class="msg" style="background:rgba(5,128,240,0.1);color:#0580f0">Descargando e instalando... No cierres esta ventana.</div>';
  try {
    const res = await fetch('/api/update', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      el.innerHTML = '<div class="msg success">Actualizado a v' + data.version + '. Reiniciando servicio...</div>';
      setTimeout(() => { location.reload(); }, 3000);
    } else {
      el.innerHTML = '<div class="msg error">Error: ' + data.error + '</div>';
    }
  } catch {
    el.innerHTML = '<div class="msg success">Servicio reiniciando... Recargando en 5s.</div>';
    setTimeout(() => { location.reload(); }, 5000);
  }
}

function renderUpdateStatus(update) {
  if (!update) return;
  const el = document.getElementById('update-status');
  if (update.available && !update.updating) {
    el.innerHTML = '<div class="msg success" style="display:flex;align-items:center;justify-content:space-between">' +
      '<span>Nueva version: <b>v' + update.version + '</b></span>' +
      '<button class="btn primary small" onclick="doUpdate()">Actualizar ahora</button></div>';
  }
}

async function refresh() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    renderWarehouses(data.tokens, data.pollStatus);
    renderPrinters(data.printers);
    renderHistory(data.history);
    updateAutoStartUI(data.autoStart);
    renderUpdateStatus(data.update);
  } catch {}
}

refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}

// ─── Local API for UI ───

function createUIServer(config) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${UI_PORT}`);

    // CORS for local
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // Routes
    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getUIHtml());
      return;
    }

    if (url.pathname === "/api/status" && req.method === "GET") {
      const current = loadConfig() || { server: "", tokens: [] };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        version: VERSION,
        platform,
        tokens: current.tokens || [],
        printers: cachedPrinters,
        history: loadHistory(),
        pollStatus: lastPollStatus,
        autoStart: isAutoStartEnabled(),
        update: updateStatus,
      }));
      return;
    }

    if (url.pathname === "/api/check-update" && req.method === "GET") {
      const current = loadConfig();
      if (!current?.server) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ available: false, error: "Sin servidor configurado" }));
        return;
      }
      const update = await checkForUpdate(current);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ available: !!update, version: update?.version || null }));
      return;
    }

    if (url.pathname === "/api/update" && req.method === "POST") {
      const current = loadConfig();
      if (!current?.server) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Sin servidor configurado" }));
        return;
      }
      const result = await performUpdate(current);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === "/api/printers" && req.method === "GET") {
      const printers = await listPrinters();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ printers }));
      return;
    }

    if (url.pathname === "/api/add-token" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => body += c);
      req.on("end", async () => {
        try {
          const { token } = JSON.parse(body);
          if (!token) { res.writeHead(400); res.end(JSON.stringify({ error: "Token requerido" })); return; }

          const current = loadConfig();
          if (!current) { res.writeHead(400); res.end(JSON.stringify({ error: "Sin configuracion base" })); return; }
          if (current.tokens.some((t) => t.token === token)) { res.writeHead(400); res.end(JSON.stringify({ error: "Token ya registrado" })); return; }

          const vRes = await fetch(`${current.server}/api/print-agent?token=${token}&version=${VERSION}`);
          if (!vRes.ok) { res.writeHead(400); res.end(JSON.stringify({ error: "Token invalido" })); return; }
          const vData = await vRes.json();

          current.tokens.push({ token, name: vData.service_name });
          saveConfig(current);
          config.tokens = current.tokens;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, name: vData.service_name }));
        } catch (err) {
          res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/remove-token" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => body += c);
      req.on("end", () => {
        try {
          const { token } = JSON.parse(body);
          const current = loadConfig();
          if (current) {
            current.tokens = current.tokens.filter((t) => t.token !== token);
            saveConfig(current);
            config.tokens = current.tokens;
            delete lastPollStatus[token];
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === "/api/autostart" && req.method === "POST") {
      const current = isAutoStartEnabled();
      setAutoStart(!current);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ enabled: !current }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`  [!] Puerto ${UI_PORT} en uso. Intentando liberar...`);
      // Try to kill the old process and retry once
      try {
        execSync(`lsof -ti :${UI_PORT} | xargs kill -9 2>/dev/null`, { stdio: "ignore" });
      } catch {}
      setTimeout(() => {
        server.listen(UI_PORT, () => {
          console.log(`  Panel web: http://localhost:${UI_PORT}`);
        });
      }, 1500);
    } else {
      console.error("  [ERROR] Server:", err.message);
    }
  });

  server.listen(UI_PORT, () => {
    console.log(`  Panel web: http://localhost:${UI_PORT}`);
  });
}

// ─── CLI commands ───

async function setup() {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log("\n  LogiRapid Print Service - Configuracion inicial\n");
  const server = (await ask("  URL del servidor: ")).trim();
  if (!server) { console.log("  [ERROR] URL del servidor requerida.\n"); rl.close(); process.exit(1); }
  const token = (await ask("  Token de emparejamiento: ")).trim();
  if (!token) { console.log("  [ERROR] Token requerido.\n"); rl.close(); process.exit(1); }

  console.log("  Verificando token...");
  try {
    const r = await fetch(`${server}/api/print-agent?token=${token}&version=${VERSION}`);
    if (!r.ok) { console.log("  [ERROR] Token invalido.\n"); rl.close(); process.exit(1); }
    const d = await r.json();
    console.log(`  [OK] Conectado a: ${d.service_name}`);
    saveConfig({ server, tokens: [{ token, name: d.service_name }] });
    console.log(`  [OK] Configuracion guardada\n`);
  } catch (e) { console.log(`  [ERROR] ${e.message}\n`); rl.close(); process.exit(1); }
  rl.close();
}

async function addTokenCLI() {
  const config = loadConfig();
  if (!config) { console.log("\n  Usa --setup primero.\n"); process.exit(1); }
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log("\n  Departamentos actuales:");
  config.tokens.forEach((t, i) => console.log(`    ${i + 1}. ${t.name}`));
  const token = (await ask("\n  Token del nuevo departamento: ")).trim();
  if (!token) { rl.close(); process.exit(1); }
  if (config.tokens.some((t) => t.token === token)) { console.log("  [!] Ya registrado.\n"); rl.close(); process.exit(0); }

  try {
    const r = await fetch(`${config.server}/api/print-agent?token=${token}&version=${VERSION}`);
    if (!r.ok) { console.log("  [ERROR] Token invalido.\n"); rl.close(); process.exit(1); }
    const d = await r.json();
    config.tokens.push({ token, name: d.service_name });
    saveConfig(config);
    console.log(`  [OK] Agregado: ${d.service_name} (total: ${config.tokens.length})\n`);
  } catch (e) { console.log(`  [ERROR] ${e.message}\n`); }
  rl.close();
}

function listTokensCLI() {
  const config = loadConfig();
  if (!config?.tokens?.length) { console.log("\n  Sin departamentos. Usa --setup.\n"); process.exit(0); }
  console.log(`\n  LogiRapid Print Service v${VERSION}`);
  console.log(`  Servidor: ${config.server}\n`);
  config.tokens.forEach((t, i) => console.log(`  ${i + 1}. ${t.name}\n     ${t.token}`));
  console.log("");
}

async function removeTokenCLI() {
  const config = loadConfig();
  if (!config?.tokens?.length) { console.log("\n  Sin departamentos.\n"); process.exit(0); }
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));

  console.log("\n  Departamentos actuales:");
  config.tokens.forEach((t, i) => console.log(`    ${i + 1}. ${t.name}`));
  const num = parseInt(await ask("\n  Numero del departamento a quitar: "), 10);
  if (isNaN(num) || num < 1 || num > config.tokens.length) { console.log("  [ERROR] Numero invalido.\n"); rl.close(); process.exit(1); }

  const removed = config.tokens.splice(num - 1, 1)[0];
  saveConfig(config);
  delete lastPollStatus[removed.token];
  console.log(`  [OK] Quitado: ${removed.name} (quedan: ${config.tokens.length})\n`);
  rl.close();
}

// ─── Main ───

async function main() {
  if (process.argv.includes("--setup")) { await setup(); process.exit(0); }
  if (process.argv.includes("--add-token")) { await addTokenCLI(); process.exit(0); }
  if (process.argv.includes("--remove-token")) { await removeTokenCLI(); process.exit(0); }
  if (process.argv.includes("--list")) { listTokensCLI(); process.exit(0); }
  if (process.argv.includes("--help")) {
    console.log(`\n  LogiRapid Print Service v${VERSION}\n\n  node server.js                Iniciar servicio\n  node server.js --setup        Configuracion inicial\n  node server.js --add-token    Agregar departamento\n  node server.js --remove-token Quitar departamento\n  node server.js --list         Ver departamentos\n  node server.js --help         Ayuda\n`);
    process.exit(0);
  }

  let config = loadConfig();
  if (!config) {
    config = { server: "", tokens: [] };
  }

  const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "5000", 10);

  console.log(`\n  LogiRapid Print Service v${VERSION}`);
  console.log(`  Plataforma: ${platform}`);

  if (!config.tokens?.length) {
    console.log(`  Sin departamentos configurados.`);
    console.log(`  Abre http://localhost:${UI_PORT} para agregar un token.`);
    console.log(`  O ejecuta: node server.js --setup\n`);
  } else {
    console.log(`  Servidor: ${config.server}`);
    console.log(`  Departamentos: ${config.tokens.map((t) => t.name).join(", ")}`);
    console.log(`  Polling cada: ${POLL_INTERVAL / 1000}s`);
  }

  // Always start UI server (even without tokens, so user can configure via web)
  createUIServer(config);

  // Check for updates on startup and every 30 minutes
  if (config.server) {
    checkForUpdate(config).then((u) => {
      if (u) console.log(`  [!] Nueva version disponible: v${u.version} — Actualiza desde http://localhost:${UI_PORT}`);
    });
    setInterval(() => checkForUpdate(config), 30 * 60 * 1000);
  }

  if (config.tokens?.length) {
    console.log(`  Esperando trabajos de impresion...\n`);
    await pollAll(config);
    setInterval(() => pollAll(config), POLL_INTERVAL);
  } else {
    console.log(`  Panel web listo. Esperando configuracion...\n`);
    // Poll periodically to check if config was added via UI
    setInterval(async () => {
      const updated = loadConfig();
      if (updated?.tokens?.length && !config.tokens?.length) {
        config = updated;
        console.log(`  [OK] Configuracion detectada: ${config.tokens.map((t) => t.name).join(", ")}`);
        console.log(`  Iniciando polling...\n`);
        await pollAll(config);
        setInterval(() => pollAll(config), POLL_INTERVAL);
      }
    }, 3000);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
