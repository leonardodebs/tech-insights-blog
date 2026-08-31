"""
Gera docs/security-audit/relatorio-auditoria-seguranca.pdf.

Uso (a partir da raiz do repositório):
    docs/security-audit/.venv/Scripts/python.exe docs/security-audit/gerar_relatorio.py

Os dados vivem em findings.py e issues.py. Este arquivo cuida só da diagramação,
para que reauditar não exija mexer em layout.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak,
                                PageTemplate, Paragraph, Preformatted, Spacer,
                                Table, TableStyle)

from findings import (ACHADOS, CORES, DATA_AUDITORIA, ESCOPO, METODOLOGIA,
                      PONTOS_FORTES, PONTOS_FRACOS, PROJETO, RECOMENDACOES, REPO)
from issues import ISSUES

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "relatorio-auditoria-seguranca.pdf")
TITULO = "Relatório de Auditoria de Segurança"

ORDEM_SEV = ["critica", "alta", "media", "baixa", "informativa"]
ROTULO_SEV = {
    "critica": "CRÍTICA", "alta": "ALTA", "media": "MÉDIA",
    "baixa": "BAIXA", "informativa": "INFORMATIVA",
}

# ---------------------------------------------------------------- estilos
ss = getSampleStyleSheet()
TINTA = colors.HexColor("#111827")
CINZA = colors.HexColor("#6B7280")
LINHA = colors.HexColor("#E5E7EB")

H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                    fontSize=17, leading=21, textColor=TINTA, spaceBefore=2, spaceAfter=10)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                    fontSize=12.5, leading=16, textColor=TINTA, spaceBefore=14, spaceAfter=6)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold",
                    fontSize=10.5, leading=14, textColor=TINTA, spaceBefore=8, spaceAfter=3)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="Helvetica", fontSize=9.3,
                   leading=13.6, textColor=TINTA, alignment=TA_JUSTIFY, spaceAfter=6)
PQ = ParagraphStyle("PQ", parent=P, fontSize=8.4, leading=12, textColor=CINZA)
CEL = ParagraphStyle("CEL", parent=P, fontSize=8.2, leading=11.4, spaceAfter=0, alignment=0)
MONO = ParagraphStyle("MONO", parent=ss["Code"], fontName="Courier", fontSize=7.2,
                      leading=9.4, textColor=colors.HexColor("#1F2937"))
CAPA_T = ParagraphStyle("CAPA_T", parent=H1, fontSize=25, leading=30, alignment=TA_CENTER)
CAPA_S = ParagraphStyle("CAPA_S", parent=P, fontSize=13, leading=18,
                        alignment=TA_CENTER, textColor=CINZA)


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def chip(sev):
    """Chip colorido de severidade, como tabela de uma célula."""
    t = Table([[Paragraph(f'<font color="white"><b>{ROTULO_SEV[sev]}</b></font>',
                          ParagraphStyle("c", parent=CEL, fontSize=6.8, leading=8.4,
                                         alignment=TA_CENTER))]],
              colWidths=[2.05 * cm], rowHeights=[0.46 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(CORES[sev])),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1), ("RIGHTPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    return t


def bloco_codigo(txt, largura=16.2):
    """Trecho de código com fundo cinza, quebrando linhas longas."""
    linhas = []
    for ln in txt.split("\n"):
        while len(ln) > 96:
            linhas.append(ln[:96])
            ln = "    " + ln[96:]
        linhas.append(ln)
    pre = Preformatted("\n".join(linhas), MONO)
    t = Table([[pre]], colWidths=[largura * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F4F6")),
        ("BOX", (0, 0), (-1, -1), 0.5, LINHA),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


# ---------------------------------------------------------------- gráficos
def grafico_rosca(path):
    cont = {s: sum(1 for a in ACHADOS if a["sev"] == s) for s in ORDEM_SEV}
    cont = {k: v for k, v in cont.items() if v}
    fig, ax = plt.subplots(figsize=(4.5, 3.3), dpi=200)
    w, _, autot = ax.pie(
        list(cont.values()),
        labels=[f"{ROTULO_SEV[k]} ({v})" for k, v in cont.items()],
        colors=[CORES[k] for k in cont],
        autopct=lambda p: f"{round(p * sum(cont.values()) / 100)}",
        startangle=90, counterclock=False,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
        textprops=dict(fontsize=8.5, color="#111827"), pctdistance=0.78)
    for a in autot:
        a.set_color("white"); a.set_fontweight("bold"); a.set_fontsize(9)
    ax.text(0, 0, f"{len(ACHADOS)}\nachados", ha="center", va="center",
            fontsize=11, fontweight="bold", color="#111827")
    ax.set(aspect="equal")
    fig.tight_layout(pad=0.2)
    fig.savefig(path, transparent=True)
    plt.close(fig)


def grafico_barras(path):
    cats, ordem = {}, []
    for a in ACHADOS:
        if a["cat"] not in cats:
            cats[a["cat"]] = []
            ordem.append(a["cat"])
        cats[a["cat"]].append(a["sev"])
    ordem.sort()
    fig, ax = plt.subplots(figsize=(5.6, 3.6), dpi=200)
    y = range(len(ordem))
    esq = [0] * len(ordem)
    for sev in ORDEM_SEV:
        vals = [sum(1 for s in cats[c] if s == sev) for c in ordem]
        if not any(vals):
            continue
        ax.barh(list(y), vals, left=esq, color=CORES[sev],
                label=ROTULO_SEV[sev], height=0.55)
        esq = [e + v for e, v in zip(esq, vals)]
    ax.set_yticks(list(y))
    ax.set_yticklabels([c if len(c) <= 30 else c[:29] + "…" for c in ordem], fontsize=8)
    ax.invert_yaxis()
    ax.set_xlabel("achados", fontsize=8)
    ax.xaxis.set_major_locator(matplotlib.ticker.MaxNLocator(integer=True))
    ax.tick_params(axis="x", labelsize=8)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", color="#E5E7EB", linewidth=0.7)
    ax.set_axisbelow(True)
    # Legenda FORA da área do gráfico: ancorada dentro (lower right) ela cobria
    # a última barra, tornando a categoria ilegível.
    ax.legend(fontsize=7, frameon=False, ncol=4,
              loc="upper center", bbox_to_anchor=(0.5, -0.16))
    fig.tight_layout(pad=0.3)
    fig.savefig(path, transparent=True)
    plt.close(fig)


# ---------------------------------------------------------------- página
def cabecalho_rodape(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(CINZA)
        canvas.drawString(2 * cm, A4[1] - 1.25 * cm, f"{TITULO} — {PROJETO}")
        canvas.setStrokeColor(LINHA)
        canvas.setLineWidth(0.5)
        canvas.line(2 * cm, A4[1] - 1.42 * cm, A4[0] - 2 * cm, A4[1] - 1.42 * cm)
        canvas.line(2 * cm, 1.5 * cm, A4[0] - 2 * cm, 1.5 * cm)
        canvas.drawString(2 * cm, 1.1 * cm, DATA_AUDITORIA)
        canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Página {doc.page}")
    canvas.restoreState()


def construir():
    rosca = os.path.join(AQUI, "_rosca.png")
    barras = os.path.join(AQUI, "_barras.png")
    grafico_rosca(rosca)
    grafico_barras(barras)

    doc = BaseDocTemplate(SAIDA, pagesize=A4,
                          leftMargin=2 * cm, rightMargin=2 * cm,
                          topMargin=2 * cm, bottomMargin=2 * cm,
                          title=f"{TITULO} — {PROJETO}", author="Auditoria técnica")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([PageTemplate(id="base", frames=[frame],
                                       onPage=cabecalho_rodape)])
    from reportlab.platypus import Image
    e = []

    # ---------------- capa
    e += [Spacer(1, 3.4 * cm),
          Paragraph(TITULO, CAPA_T),
          Spacer(1, 0.3 * cm),
          Paragraph(PROJETO, CAPA_S),
          Spacer(1, 0.9 * cm)]
    reg = Table([[Paragraph(f"<b>Data</b>", CEL), Paragraph(DATA_AUDITORIA, CEL)],
                 [Paragraph("<b>Repositório</b>", CEL), Paragraph(esc(REPO), CEL)],
                 [Paragraph("<b>Achados</b>", CEL),
                  Paragraph(f"{len(ACHADOS)} ({sum(1 for a in ACHADOS if a['sev']=='alta')} de severidade alta)", CEL)],
                 [Paragraph("<b>Controles validados</b>", CEL),
                  Paragraph(f"{len(PONTOS_FORTES)} pontos fortes com evidência", CEL)]],
                colWidths=[4 * cm, 10.5 * cm], hAlign="CENTER")
    reg.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, LINHA),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F9FAFB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    e += [reg, Spacer(1, 0.9 * cm), Paragraph("Escopo auditado", H2)]
    for s in ESCOPO:
        e.append(Paragraph(f"• {esc(s)}", PQ))
    e += [Spacer(1, 0.5 * cm), Paragraph("Nota metodológica", H2),
          Paragraph("Cada categoria genérica foi mapeada para o equivalente real desta stack "
                    "antes da análise, conforme abaixo. Todo achado foi confirmado no código; "
                    "nada foi inferido.", PQ)]
    for t, d in METODOLOGIA:
        e.append(Paragraph(f"<b>{esc(t)}.</b> {esc(d)}", PQ))
    e.append(PageBreak())

    # ---------------- resumo executivo
    e.append(Paragraph("Resumo executivo", H1))
    cont = {s: sum(1 for a in ACHADOS if a["sev"] == s) for s in ORDEM_SEV}
    linha = [[chip(s), Paragraph(f"<b>{cont[s]}</b>", CEL)] for s in ORDEM_SEV if cont[s]]
    tot = Table([[c for par in linha for c in par]],
                colWidths=[2.05 * cm, 0.9 * cm] * len(linha))
    tot.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                             ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    e += [tot, Spacer(1, 0.25 * cm)]
    e.append(Paragraph(
        "A auditoria percorreu 65 arquivos versionados e cerca de 3.900 linhas de código, "
        "além do histórico completo do git e do bundle publicado em produção. "
        f"Foram identificados {len(ACHADOS)} achados e confirmados {len(PONTOS_FORTES)} controles "
        "funcionando corretamente. Nenhuma falha crítica foi encontrada. Os dois achados de "
        "severidade alta eram um bypass de MFA no servidor e um XSS refletido no servidor de "
        "desenvolvimento. <b>Esta revisão registra os 8 achados já corrigidos e verificados</b>, "
        "com as Edge Functions redeployadas e o site validado em produção.", P))
    graf = Table([[Image(rosca, width=7.6 * cm, height=5.6 * cm),
                   Image(barras, width=8.6 * cm, height=5.5 * cm)]],
                 colWidths=[8.0 * cm, 9.0 * cm])
    graf.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                              ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    e += [Spacer(1, 0.2 * cm), graf, Spacer(1, 0.15 * cm),
          Paragraph("À esquerda, distribuição por severidade. À direita, achados por categoria "
                    "auditada, empilhados por severidade.", PQ)]

    # ---------------- fracos
    e.append(Paragraph("Pontos fracos: os riscos centrais", H2))
    for i, f in enumerate(PONTOS_FRACOS, 1):
        e.append(Paragraph(f"<b>{i}.</b> {esc(f)}", P))
    e.append(PageBreak())

    # ---------------- fortes
    e.append(Paragraph("Pontos fortes verificados", H1))
    e.append(Paragraph("Cada item abaixo foi conferido no código e está correto. A lista também "
                       "serve como prova da cobertura da auditoria.", PQ))
    dados = [[Paragraph("<b>Controle</b>", CEL), Paragraph("<b>Evidência</b>", CEL),
              Paragraph("<b>Observação</b>", CEL)]]
    for t, ev, ob in PONTOS_FORTES:
        dados.append([Paragraph(f"<b>{esc(t)}</b>", CEL),
                      Paragraph(f'<font face="Courier" size="7">{esc(ev)}</font>', CEL),
                      Paragraph(esc(ob), CEL)])
    # Padding enxuto de propósito: com 5pt a tabela transbordava uma única linha
    # para a página seguinte, deixando uma órfã com o cabeçalho repetido.
    tf = Table(dados, colWidths=[4.3 * cm, 4.4 * cm, 8.3 * cm], repeatRows=1)
    tf.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ECFDF5")),
        ("LINEBEFORE", (0, 1), (0, -1), 2.2, colors.HexColor(CORES["forte"])),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
    ]))
    e += [tf, PageBreak()]

    # ---------------- achados detalhados
    e.append(Paragraph("Achados detalhados", H1))
    e.append(Paragraph("Ordenados por severidade. Cada achado traz arquivo e linha exatos, o "
                       "trecho real do código e a condição necessária para exploração.", PQ))
    for a in sorted(ACHADOS, key=lambda x: ORDEM_SEV.index(x["sev"])):
        cab = Table([[chip(a["sev"]),
                      Paragraph(f'<b>{a["id"]} — {esc(a["titulo"])}</b>', CEL)]],
                    colWidths=[2.2 * cm, 14.6 * cm])
        cab.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                 ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
        bloco = [Spacer(1, 0.25 * cm), cab,
                 Paragraph(f'<font face="Courier" size="7.6">{esc(a["arquivo"])}</font>'
                           f'  <font size="7.6" color="#6B7280">| {esc(a["cat"])}</font>', CEL),
                 Spacer(1, 0.16 * cm), bloco_codigo(a["codigo"]), Spacer(1, 0.16 * cm),
                 Paragraph(f'<b>Por que é explorável.</b> {esc(a["porque"])}', P),
                 Paragraph(f'<b>Impacto.</b> {esc(a["impacto"])}', P)]
        if a.get("condicao"):
            bloco.append(Paragraph(f'<b>Condição.</b> {esc(a["condicao"])}', PQ))
        bloco.append(Paragraph(f'<b>Correção.</b> {esc(a["correcao"])}', P))
        if a.get("status_correcao"):
            st = Table([[Paragraph(
                f'<font color="{CORES["forte"]}"><b>✓ {esc(a["status_correcao"])}</b></font>',
                ParagraphStyle("s", parent=CEL, fontSize=8))]], colWidths=[16.6 * cm])
            st.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")),
                ("LINEBEFORE", (0, 0), (0, -1), 2.2, colors.HexColor(CORES["forte"])),
                ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            bloco += [Spacer(1, 0.1 * cm), st]
        if a.get("arquivos_extra"):
            bloco.append(Paragraph(
                "<b>Também relevante:</b> " +
                ", ".join(f'<font face="Courier" size="7">{esc(x)}</font>'
                          for x in a["arquivos_extra"]), PQ))
        e.append(KeepTogether(bloco))
    e.append(PageBreak())

    # ---------------- tabela resumo
    e.append(Paragraph("Tabela de achados por categoria", H1))
    cats = sorted({a["cat"] for a in ACHADOS})
    for c in cats:
        e.append(Paragraph(esc(c), H2))
        d = [[Paragraph("<b>Sev.</b>", CEL), Paragraph("<b>Arquivo:linha</b>", CEL),
              Paragraph("<b>Descrição</b>", CEL)]]
        for a in sorted([x for x in ACHADOS if x["cat"] == c],
                        key=lambda x: ORDEM_SEV.index(x["sev"])):
            d.append([chip(a["sev"]),
                      Paragraph(f'<font face="Courier" size="7">{esc(a["arquivo"])}</font>', CEL),
                      Paragraph(f'<b>{a["id"]}</b> — {esc(a["titulo"])}', CEL)])
        t = Table(d, colWidths=[2.3 * cm, 4.6 * cm, 10.1 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F9FAFB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        e.append(t)
    e.append(PageBreak())

    # ---------------- recomendações
    e.append(Paragraph("Recomendações priorizadas", H1))
    d = [[Paragraph("<b>Pri.</b>", CEL), Paragraph("<b>Ação</b>", CEL),
          Paragraph("<b>Detalhe</b>", CEL), Paragraph("<b>Achados</b>", CEL)]]
    for pri, tit, det, ids in RECOMENDACOES:
        cor = {"P1": CORES["alta"], "P2": CORES["media"], "P3": CORES["baixa"]}[pri]
        d.append([Paragraph(f'<font color="{cor}"><b>{pri}</b></font>', CEL),
                  Paragraph(f"<b>{esc(tit)}</b>", CEL),
                  Paragraph(esc(det), CEL),
                  Paragraph(", ".join(ids), CEL)])
    t = Table(d, colWidths=[1.3 * cm, 4.3 * cm, 8.9 * cm, 2.5 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, LINHA),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F9FAFB")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
    ]))
    e.append(t)

    # ---------------- issues
    # Título e introdução ficam ao pé da página de recomendações de propósito:
    # isolados numa página própria, sobrava uma folha quase em branco.
    e.append(Spacer(1, 0.5 * cm))
    e.append(Paragraph("Issues para o GitHub", H1))
    e.append(Paragraph("Texto completo em Markdown, pronto para copiar e colar. Achados triviais "
                       "do mesmo tema foram agrupados numa issue só para não gerar ruído.", PQ))
    # Uma issue por página: o bloco Markdown é alto e, fluindo livre, deixava
    # páginas quase vazias com só o cabeçalho da issue. Página fixa também
    # facilita imprimir ou recortar uma issue isolada.
    for it in ISSUES:
        e.append(PageBreak())
        e.append(Paragraph(f'--- ISSUE {it["n"]} ---', H3))
        cab = Table([[Paragraph(f'<b>Título:</b> {esc(it["titulo"])}', CEL)],
                     [Paragraph(f'<b>Labels:</b> {esc(it["labels"])}', CEL)]],
                    colWidths=[16.6 * cm])
        cab.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
            ("BOX", (0, 0), (-1, -1), 0.5, LINHA),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, LINHA),
            ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        e += [cab, Spacer(1, 0.12 * cm), bloco_codigo(it["md"].strip()),
              Paragraph(f'--- FIM ISSUE {it["n"]} ---', PQ), Spacer(1, 0.4 * cm)]

    doc.build(e)
    for f in (rosca, barras):
        if os.path.exists(f):
            os.remove(f)
    print(f"PDF gerado: {SAIDA}")


if __name__ == "__main__":
    construir()
