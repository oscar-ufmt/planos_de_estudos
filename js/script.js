let obrig = [];
let cursadas = JSON.parse(localStorage.getItem('cursadas_ufmt')) || [];
let plano = JSON.parse(localStorage.getItem('plano_ufmt')) || {};
let semestreAtivo = "";

const REGRAS_PPC = {
    "2014": { min: 10, max: 15, dil: 17.5, limiteCr: 40 },
    "2020": { min: 8,  max: 12, dil: 14,   limiteCr: 32 },
    "2025": { min: 10, max: 15, dil: 17.5, limiteCr: 36 },
    "2026": { min: 10, max: 15, dil: 17.5, limiteCr: 36 }
};

const REGRAS_OFERTA = {
    "2026/1": { "20261": [1, 9, 10], "20251": [2, 4, 6, 8, 9, 10] },
    "2026/2": { "20261": [2, 9, 10], "20251": [3, 5, 7, 9, 10] },
    "2027/1": { "20261": [1, 3, 9, 10], "20251": [4, 6, 8, 9, 10] },
    "2027/2": { "20261": [2, 4, 9, 10], "20251": [5, 7, 9, 10] },
    "2028/1": { "20261": [1, 3, 5, 9, 10], "20251": [6, 8, 9, 10] },
    "2028/2": { "20261": [2, 4, 6, 9, 10], "20251": [7, 9, 10] },
    "2029/1": { "20261": [1, 3, 5, 7, 9, 10], "20251": [8, 9, 10] },
    "2029/2": { "20261": [2, 4, 6, 8, 9, 10], "20251": [] }
};

async function carregar() {
    try {
        const res = await fetch('./data/disciplinas_obrigatorias.json');
        obrig = await res.json();
        const sems = Object.keys(plano).sort();
        if (sems.length > 0) semestreAtivo = sems[sems.length - 1];
        carregarInfoAdicional();
        renderizarTudo();
    } catch (e) { console.error("Erro ao carregar dados."); }
}

function somarSemestres(anoOrigem, semOrigem, qtdAdicionar) {
    let totalSems = (anoOrigem * 2 + (semOrigem - 1)) + (qtdAdicionar - 1);
    let anoResult = Math.floor(totalSems / 2);
    let semResult = (totalSems % 2) + 1;
    return `${anoResult}/${semResult}`;
}

function calcularPrazos() {
    const anoIng = parseInt(document.getElementById('ingressoAno').value);
    const semIng = parseInt(document.getElementById('ingressoSemestre').value);
    const ppcIng = document.getElementById('ppcIngresso').value;
    const trancamentos = parseInt(document.getElementById('trancamentos').value) || 0;
    const regra = REGRAS_PPC[ppcIng];
    if (!regra || isNaN(anoIng)) return;
    const pMin = somarSemestres(anoIng, semIng, regra.min + trancamentos);
    const pMax = somarSemestres(anoIng, semIng, regra.max + trancamentos);
    const pDil = somarSemestres(anoIng, semIng, Math.floor(regra.dil) + trancamentos);
    const semsPlan = Object.keys(plano).sort();
    const ultimoSemPlan = semsPlan[semsPlan.length - 1] || "0000/0";
    const painel = document.getElementById('painelPrazos');
    painel.innerHTML = `<div class="card-prazo"><b>🎓 Mínimo Formatura</b>PPC ${ppcIng}: ${pMin}</div>
                        <div class="card-prazo ${ultimoSemPlan > pMax ? 'alerta' : ''}"><b>⚠️ Limite Máximo</b>Máximo: ${pMax} | Dilação: ${pDil}</div>
                        <div class="card-prazo"><b>📚 Limite Créditos</b>${regra.limiteCr} CR</div>`;
}

function salvarInfoAdicional() {
    const info = {
        nome: document.getElementById('alunoNome').value, rga: document.getElementById('alunoRGA').value,
        sei: document.getElementById('alunoSEI').value, anoIng: document.getElementById('ingressoAno').value,
        semIng: document.getElementById('ingressoSemestre').value, ppcIng: document.getElementById('ppcIngresso').value,
        tranc: document.getElementById('trancamentos').value
    };
    localStorage.setItem('info_aluno_ufmt', JSON.stringify(info));
    calcularPrazos();
}

function carregarInfoAdicional() {
    const info = JSON.parse(localStorage.getItem('info_aluno_ufmt'));
    if (info) {
        document.getElementById('alunoNome').value = info.nome || "";
        document.getElementById('alunoRGA').value = info.rga || "";
        document.getElementById('alunoSEI').value = info.sei || "";
        document.getElementById('ingressoAno').value = info.anoIng || "2022";
        document.getElementById('ingressoSemestre').value = info.semIng || "1";
        document.getElementById('ppcIngresso').value = info.ppcIng || "2026";
        document.getElementById('trancamentos').value = info.tranc || "0";
    }
    calcularPrazos();
}

// NOVO: EXPORTAR JSON
function exportarJSON() {
    const dadosBackup = {
        cursadas: cursadas,
        plano: plano,
        infoAluno: JSON.parse(localStorage.getItem('info_aluno_ufmt'))
    };
    const blob = new Blob([JSON.stringify(dadosBackup, null, 2)], { type: 'application/json' });
    const link = document.createElement("a");
    const nome = (dadosBackup.infoAluno?.nome || "PLANO").replace(/\s/g, "_").toUpperCase();
    link.href = URL.createObjectURL(blob);
    link.download = `BACKUP_UFMT_${nome}.json`;
    link.click();
}

// NOVO: IMPORTAR JSON
function importarJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result);
            if (confirm("Deseja substituir seus dados atuais pelos dados deste arquivo?")) {
                if (dados.cursadas) localStorage.setItem('cursadas_ufmt', JSON.stringify(dados.cursadas));
                if (dados.plano) localStorage.setItem('plano_ufmt', JSON.stringify(dados.plano));
                if (dados.infoAluno) localStorage.setItem('info_aluno_ufmt', JSON.stringify(dados.infoAluno));
                location.reload();
            }
        } catch (err) { alert("Erro ao ler o arquivo JSON."); }
    };
    reader.readAsText(file);
}

function renderizarTudo() {
    const ppc = document.getElementById('filtroPPC').value;
    const ppcKey = `ppc_${ppc}`;
    const mapaPlano = {};
    Object.entries(plano).forEach(([sem, cods]) => cods.forEach(c => mapaPlano[c] = sem));
    const boxHistorico = document.getElementById('checklistObrigatorias');
    boxHistorico.innerHTML = '';
    const semestres = {};
    obrig.forEach(d => {
        if (d[ppcKey]) {
            if (!semestres[d[ppcKey]]) semestres[d[ppcKey]] = [];
            semestres[d[ppcKey]].push(d);
        }
    });
    Object.keys(semestres).sort((a,b) => a-b).forEach(s => {
        const coluna = document.createElement('div');
        coluna.className = 'coluna-semestre';
        coluna.innerHTML = `<h4>${s}º Semestre</h4>`;
        const lista = document.createElement('div');
        lista.className = 'lista-disciplinas-vertical';
        semestres[s].forEach(d => {
            const isChecked = cursadas.includes(d.codigo);
            const planejado = mapaPlano[d.codigo];
            const preReqs = (d.prerequisitos || []).map(c => obrig.find(o => o.codigo === c)?.nome || c).join(', ');
            const item = document.createElement('div');
            item.className = `item-check ${isChecked ? 'active' : ''} ${planejado ? 'is-planned' : ''}`;
            item.innerHTML = `<input type="checkbox" id="c-${d.codigo}" ${isChecked ? 'checked' : ''} onchange="toggle('${d.codigo}')">
                <label for="c-${d.codigo}"><strong>${d.codigo}</strong><small>${d.nome}</small>
                ${planejado ? `<div style="font-size:0.55rem; color:var(--primary); font-weight:700">📅 ${planejado}</div>` : ''}
                ${preReqs ? `<div class="tag-pre">Req: ${preReqs}</div>` : ''}</label>`;
            lista.appendChild(item);
        });
        coluna.appendChild(lista);
        boxHistorico.appendChild(coluna);
    });
    renderizarPendencias(ppcKey);
    renderizarGrade();
    calcularPrazos();
    localStorage.setItem('cursadas_ufmt', JSON.stringify(cursadas));
    localStorage.setItem('plano_ufmt', JSON.stringify(plano));
}

function renderizarPendencias(ppcKey) {
    const box = document.getElementById('listaDisponiveis');
    box.innerHTML = semestreAtivo ? '' : '<p style="color:red; font-size:0.7rem; padding:10px">Selecione um semestre.</p>';
    if (!semestreAtivo) return;
    const jaPlano = Object.values(plano).flat();
    const oferta = REGRAS_OFERTA[semestreAtivo];
    const [anoAtivo, periodoAtivo] = semestreAtivo.split('/').map(Number);
    obrig.filter(d => {
        let estaOfertada = false;
        if (oferta) {
            if (d.ppc_20261 && oferta["20261"].includes(d.ppc_20261)) estaOfertada = true;
            if (d.ppc_20251 && oferta["20251"].includes(d.ppc_20251)) estaOfertada = true;
        } else if (anoAtivo >= 2030) {
            const semD = d.ppc_20261;
            if (semD && ((periodoAtivo === 1 && semD % 2 !== 0) || (periodoAtivo === 2 && semD % 2 === 0))) estaOfertada = true;
        } else { estaOfertada = !!d[ppcKey]; }
        return estaOfertada && !cursadas.includes(d.codigo) && !jaPlano.includes(d.codigo);
    }).forEach(d => {
        const preReqCodes = d.prerequisitos || [];
        const cumpre = preReqCodes.every(p => cursadas.includes(p));
        const div = document.createElement('div');
        div.className = `mini-card ${!cumpre ? 'alerta-pre' : ''}`;
        div.innerHTML = `<div style="flex:1"><strong>${d.codigo}</strong><small>${d.nome}</small></div><button onclick="addAoPlano('${d.codigo}')">ADD</button>`;
        box.appendChild(div);
    });
}

function renderizarGrade() {
    const box = document.getElementById('gradeSemestres');
    box.innerHTML = '';
    const ppcAtual = document.getElementById('filtroPPC').value;
    const limiteCr = (ppcAtual === "20251" || ppcAtual === "20261") ? 36 : 32;
    Object.entries(plano).forEach(([sem, cods]) => {
        let cr = 0;
        const col = document.createElement('div');
        col.className = `coluna-semestre ${sem === semestreAtivo ? 'semestre-selecionado' : ''}`;
        col.onclick = () => { semestreAtivo = sem; renderizarTudo(); };
        const lista = document.createElement('div');
        lista.className = 'lista-disciplinas-vertical';
        cods.forEach(c => {
            const d = obrig.find(x => x.codigo === c);
            if (d) {
                cr += (parseInt(d.carga_horaria) || 0) / 16;
                const item = document.createElement('div');
                item.className = 'card-disciplina';
                item.innerHTML = `<label style="flex:1"><strong>${c}</strong><br><small>${d.nome}</small></label><b onclick="event.stopPropagation(); delDisc('${sem}','${c}')" style="color:red; cursor:pointer">×</b>`;
                lista.appendChild(item);
            }
        });
        const badgeClass = cr > limiteCr ? 'badge-creditos excesso-creditos' : 'badge-creditos';
        col.innerHTML = `<h4>${sem === semestreAtivo ? '📌 ' : ''}${sem} <span class="${badgeClass}">${cr} / ${limiteCr} CR</span><span onclick="event.stopPropagation(); removerSemestre('${sem}')">🗑</span></h4>`;
        col.appendChild(lista);
        box.appendChild(col);
    });
}

function exportarExcel() {
    const nomeAluno = document.getElementById('alunoNome').value || "ALUNO";
    const ppcTexto = document.getElementById('filtroPPC').options[document.getElementById('filtroPPC').selectedIndex].text;
    let csv = `SUGESTÃO DE PLANO DE ESTUDOS;;;;\nDISCIPLINA DO PPC ${ppcTexto};;;;\n\nCÓDIGO;CARGA HORÁRIA;NOME;Ano;Semestre\n`;
    Object.keys(plano).sort().forEach(semKey => {
        const [ano, periodo] = semKey.split('/');
        plano[semKey].forEach((c, index) => {
            const d = obrig.find(x => x.codigo === c);
            if (d) csv += `${c};${d.carga_horaria};${d.nome};${index === 0 ? ano : ""};${index === 0 ? periodo : ""}\n`;
        });
        csv += `;;;; \n`;
    });
    csv += `\n114200404;160;Estágio Curricular Supervisionado;;\n114200403;384;Atividades de Extensão;;\n114200402;160;Atividades Complementares;;\n`;
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PLANO_${nomeAluno.toUpperCase()}.csv`;
    link.click();
}

function toggle(c) {
    if(cursadas.includes(c)) cursadas = cursadas.filter(x => x !== c);
    else { cursadas.push(c); Object.keys(plano).forEach(s => plano[s] = plano[s].filter(x => x !== c)); }
    renderizarTudo();
}
function addAoPlano(c) { if(semestreAtivo) { plano[semestreAtivo].push(c); renderizarTudo(); } }
function delDisc(s, c) { plano[s] = plano[s].filter(x => x !== c); renderizarTudo(); }
function removerSemestre(s) { if(confirm(`Remover ${s}?`)) { delete plano[s]; semestreAtivo = ""; renderizarTudo(); } }
function addSemestre() {
    let sems = Object.keys(plano).sort();
    let n = sems.length ? somarSemestres(parseInt(sems[sems.length-1].split('/')[0]), parseInt(sems[sems.length-1].split('/')[1]), 2) : prompt("Início (Ex: 2026/1)");
    if(n && !plano[n]) { plano[n] = []; semestreAtivo = n; renderizarTudo(); }
}
function limparDados() { if(confirm("Resetar?")) { localStorage.clear(); location.reload(); } }
function gerarPDF() { window.print(); }

carregar();