#!/usr/bin/env python3
"""
Gerador de Evidencia de QA
Chamado pelo comando /evidencia do Claude Code.
"""
import argparse, base64, os, platform, shutil, subprocess, sys, tempfile
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = SCRIPT_DIR.parent / "templates"
PROJECT_ROOT = SCRIPT_DIR.parent.parent
TAREFAS_DIR = PROJECT_ROOT / "tarefas"
# Fallback para quando o --id nao corresponde a uma pasta de tarefa (amostra,
# rascunho). Uma tarefa de verdade grava em tarefas/<ID>/documento/.
EVIDENCIAS_FALLBACK = PROJECT_ROOT / "docs" / "evidencias"
# TODO(empresa): nome que sai no rodape do PDF.
EMPRESA = "Sua Empresa"
SKILL_COVER_DIR = PROJECT_ROOT / ".claude" / "skills" / "captura-evidencia"
# A capa mora junto da skill captura-evidencia; TEMPLATES_DIR e fallback.
# TODO(empresa): coloque cover.jpg (A4 retrato) em .claude/skills/captura-evidencia/.
# Sem capa, o PDF sai sem a pagina de capa.
COVER_CANDIDATES = [("image/jpeg", SKILL_COVER_DIR / "cover.jpg"), ("image/png", SKILL_COVER_DIR / "cover.png"), ("image/jpeg", TEMPLATES_DIR / "cover.jpg"), ("image/png", TEMPLATES_DIR / "cover.png")]
COVER_B64_CANDIDATES = [("image/jpeg", TEMPLATES_DIR / "cover-jpg.b64"), ("image/png", TEMPLATES_DIR / "cover.b64")]

def _is_wsl():
    try:
        with open("/proc/version") as f: return "microsoft" in f.read().lower()
    except: return False

IS_WSL = _is_wsl()

def _get_downloads_dir():
    if not IS_WSL: return Path.home() / "Downloads"
    skip = {"Public","Default","Default User","All Users"}
    ud = Path("/mnt/c/Users")
    if ud.exists():
        for d in sorted(ud.iterdir()):
            if d.name not in skip and d.is_dir() and (d/"Downloads").is_dir(): return d/"Downloads"
    return Path.home() / "Downloads"

DOWNLOADS_DIR = _get_downloads_dir()

def _wsl_to_win(p):
    try:
        r = subprocess.run(["wslpath","-w",str(p)], capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and r.stdout.strip(): return r.stdout.strip()
    except: pass
    return str(p)

TEMPLATE = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Evidencia - {nome_tarefa}</title>
<style>
*,*::before,*::after{{margin:0;padding:0;box-sizing:border-box}}
@page{{size:A4;margin:0!important}}
@media print{{html,body{{margin:0!important;padding:0!important}}body{{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}.cover-page{{break-after:page}}}}
html{{margin:0;padding:0}}
body{{margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.cover-page{{width:100%;height:297mm;margin:0;padding:0;position:relative;overflow:hidden;page-break-after:always;line-height:0;font-size:0}}
.cover-page img{{width:100%;height:100%;object-fit:cover;display:block;margin:0;padding:0}}
.content-page{{width:210mm;min-height:297mm;padding:55px 65px}}
.task-title{{color:#2A7A8A;font-size:22px;font-weight:600;text-align:center;margin-bottom:28px;line-height:1.4}}
.separator{{border:none;border-top:1.5px solid #D0D0D0;margin-bottom:22px}}
.task-link{{display:block;color:#2A7A8A;font-size:13px;text-decoration:underline;margin-bottom:14px;word-break:break-all}}
.meta-row{{font-size:14px;margin-bottom:5px;line-height:1.7}}
.meta-label{{font-weight:700;color:#2A7A8A}}
.meta-value{{font-weight:600;color:#333}}
.evidence-header{{color:#2A7A8A;font-size:26px;font-weight:300;margin-top:35px;margin-bottom:20px}}
.evidence-content{{font-size:14px;line-height:1.7}}
.evidence-content img{{max-width:100%;margin:15px 0;border:1px solid #E0E0E0;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.08)}}
.evidence-content p{{margin-bottom:12px}}
.evidence-content ul,.evidence-content ol{{margin-left:24px;margin-bottom:12px}}
.evidence-content li{{margin-bottom:4px}}
.evidence-content h3{{color:#2A7A8A;font-size:16px;font-weight:600;margin:22px 0 10px 0}}
.evidence-content h4{{color:#555;font-size:14px;font-weight:600;margin:16px 0 8px 0}}
.evidence-content pre{{background:#F5F7F8;padding:14px;border-radius:4px;font-size:12px;overflow-x:auto;margin:10px 0;border:1px solid #E8E8E8;font-family:'Cascadia Code','Fira Code',Consolas,monospace}}
.evidence-content code{{background:#F0F2F3;padding:2px 6px;border-radius:3px;font-size:12px;font-family:'Cascadia Code','Fira Code',Consolas,monospace}}
.evidence-content table{{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px}}
.evidence-content th{{background:#2A7A8A;color:white;padding:8px 12px;text-align:left;font-weight:600}}
.evidence-content td{{padding:8px 12px;border-bottom:1px solid #E0E0E0}}
.evidence-content tr:nth-child(even) td{{background:#F8FAFB}}
.evidence-content .screenshot-caption{{font-size:12px;color:#777;font-style:italic;margin-top:-10px;margin-bottom:16px}}
.page-break{{page-break-before:always}}
.page-footer{{margin-top:40px;padding-top:15px;border-top:1px solid #E0E0E0;font-size:10px;color:#AAA;text-align:right}}
</style></head><body>
{cover_html}
<div class="content-page">
<div class="task-title">{nome_tarefa}</div><hr class="separator">{link_html}
<div class="meta-row"><span class="meta-label">QA:</span> <span class="meta-value">{nome_qa}</span></div>
<div class="meta-row"><span class="meta-label">Cliente:</span> <span class="meta-value">{nome_cliente}</span></div>
<div class="meta-row"><span class="meta-label">Projeto:</span> <span class="meta-value">{nome_projeto}</span></div>
<div class="evidence-header">Evidencia:</div>
<div class="evidence-content">{evidencia_conteudo}</div>
<div class="page-footer">Gerado em {data_geracao} | {empresa}</div>
</div></body></html>"""

def load_cover():
    for m,p in COVER_CANDIDATES:
        if p.exists():
            with open(p,"rb") as f: return m, base64.b64encode(f.read()).decode("ascii")
    for m,p in COVER_B64_CANDIDATES:
        if p.exists(): return m, p.read_text().strip()
    print("AVISO: capa nao encontrada (cover.jpg em .claude/skills/captura-evidencia/). PDF sem capa.", file=sys.stderr)
    return None, None

def embed_images(content, image_paths):
    if not image_paths: return content
    h = ""
    for ip in image_paths:
        p = Path(ip)
        if not p.exists(): continue
        ext = p.suffix.lower().lstrip(".")
        mime = {"jpg":"jpeg","jpeg":"jpeg","png":"png","gif":"gif","bmp":"bmp","webp":"webp"}.get(ext,"png")
        with open(p,"rb") as f: b = base64.b64encode(f.read()).decode("ascii")
        h += f'<img src="data:image/{mime};base64,{b}" alt="{p.name}">\n<p class="screenshot-caption">{p.name}</p>\n'
    return content + "\n<h3>Screenshots</h3>\n" + h if h else content

def find_browser():
    candidates = []
    if platform.system() == "Windows":
        candidates = [("edge",r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),("edge",r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),("chrome",r"C:\Program Files\Google\Chrome\Application\chrome.exe"),("chrome",r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe")]
    elif IS_WSL:
        candidates = [("edge","/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),("edge","/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"),("chrome","/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"),("chrome","/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe")]
    for n,p in candidates:
        if os.path.isfile(p): return n, p
    for cmd in ["google-chrome","chromium-browser","chromium"]:
        p = shutil.which(cmd)
        if p: return "chrome", p
    return None

def convert_to_pdf(html_path, pdf_path):
    browser = find_browser()
    if not browser:
        print("ERRO: Nenhum browser (Edge/Chrome) encontrado.", file=sys.stderr)
        return False
    n, exe = browser
    if IS_WSL:
        hw = _wsl_to_win(html_path); pw = _wsl_to_win(pdf_path)
        uri = "file:///" + hw.replace("\\","/")
        cmd = [exe,"--headless","--disable-gpu","--no-sandbox",f"--print-to-pdf={pw}","--no-margins",uri]
    else:
        cmd = [exe,"--headless","--disable-gpu","--no-sandbox",f"--print-to-pdf={pdf_path}","--no-margins",html_path.as_uri()]
    try:
        subprocess.run(cmd, capture_output=True, timeout=30)
        return pdf_path.exists() and pdf_path.stat().st_size > 0
    except: return False

def open_file(fp):
    try:
        if platform.system()=="Windows": os.startfile(str(fp))
        elif IS_WSL: subprocess.Popen(["cmd.exe","/c","start","",_wsl_to_win(fp)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif platform.system()=="Darwin": subprocess.Popen(["open",str(fp)])
        else: subprocess.Popen(["xdg-open",str(fp)])
    except: pass

def documento_da_tarefa(tid):
    """Onde salvar o documento final: tarefas/<ID>/documento/.

    O --id do comando e o ID da tarefa (ex.: TSK-12345), que e o nome da pasta. Se a
    pasta nao existir — amostra, rascunho, ID digitado errado — cai no deposito
    antigo em vez de criar uma pasta de tarefa fantasma.
    """
    pasta = TAREFAS_DIR / tid
    return pasta / "documento" if pasta.is_dir() else EVIDENCIAS_FALLBACK


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tarefa",required=True); ap.add_argument("--qa","--dev",dest="qa",required=True)
    # Sem default: este projeto e multi-cliente (16 clientes / 25 sistemas). Um
    # default silencioso carimbaria o cliente errado na capa da evidencia.
    ap.add_argument("--cliente",required=True); ap.add_argument("--projeto",required=True)
    ap.add_argument("--link",default=""); ap.add_argument("--id",default="")
    ap.add_argument("--conteudo-file",required=True); ap.add_argument("--imagens",nargs="*",default=[])
    a = ap.parse_args()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S"); tid = a.id or "SEM-ID"; data = datetime.now().strftime("%d/%m/%Y")
    cm, cb = load_cover()
    cp = Path(a.conteudo_file)
    if not cp.exists(): print(f"ERRO: Conteudo nao encontrado: {cp}", file=sys.stderr); sys.exit(1)
    cont = embed_images(cp.read_text(encoding="utf-8"), a.imagens)
    lh = f'<a class="task-link" href="{a.link}" target="_blank">{a.link}</a>' if a.link else ""
    cover_html = f'<div class="cover-page"><img src="data:{cm};base64,{cb}" alt="Capa"></div>' if cb else ""
    html = TEMPLATE.format(nome_tarefa=a.tarefa,cover_html=cover_html,empresa=EMPRESA,link_html=lh,nome_qa=a.qa,nome_cliente=a.cliente,nome_projeto=a.projeto,evidencia_conteudo=cont,data_geracao=data)
    tmp = tempfile.NamedTemporaryFile(suffix=".html",delete=False,mode="w",encoding="utf-8"); tmp.write(html); tmp.close()
    pdf_path = DOWNLOADS_DIR / f"Evidencia - {tid}-{ts}.pdf"; DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        if not convert_to_pdf(Path(tmp.name), pdf_path): print("ERRO: Falha ao gerar PDF.", file=sys.stderr); sys.exit(2)
    finally: Path(tmp.name).unlink(missing_ok=True)
    print(f"PDF:  {pdf_path}"); print(f"SIZE: {pdf_path.stat().st_size} bytes")
    # O documento final mora na pasta da propria tarefa, junto do contexto e das
    # evidencias que o originaram — nao num deposito global onde a evidencia de
    # um cliente fica ao lado da de outro.
    destino = documento_da_tarefa(tid)
    destino.mkdir(parents=True, exist_ok=True)
    carimbo = datetime.now().strftime('%Y-%m-%d_%H%M%S')
    lp = destino / f"Evidencia-{tid}-{carimbo}.html"
    lp.write_text(html, encoding="utf-8"); print(f"LOCAL: {lp}")
    # O PDF continua indo para Downloads (e de la que ele e anexado no ClickUp),
    # mas fica tambem na tarefa: sem isso o unico PDF do projeto some junto com
    # a pasta de downloads da maquina.
    try:
        shutil.copy2(pdf_path, destino / lp.with_suffix(".pdf").name)
        print(f"LOCAL: {destino / lp.with_suffix('.pdf').name}")
    except OSError as e:
        print(f"AVISO: nao deu para copiar o PDF para {destino}: {e}", file=sys.stderr)
    open_file(pdf_path); print(f"OPEN: {pdf_path}")

if __name__ == "__main__": main()