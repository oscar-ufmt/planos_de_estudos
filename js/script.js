let obrig = [];
let cursadas = JSON.parse(localStorage.getItem('cursadas_ufmt')) || [];
let plano = JSON.parse(localStorage.getItem('plano_ufmt')) || {};
let semestreAtivo = "";

const REGRAS_PPC = {
    "2014": { min: 10, max: 15, dil: 17.5 },
    "2020": { min: 8,  max: 12, dil: 14 },
    "2025": { min: 10, max: 15, dil: 17.5 },
    "2026": { min: 10, max: 15, dil: 17.5 }
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
    } catch (e) { alert("Erro ao carregar banco de dados."); }
}

function somarSemestres(ano, sem, qtd) {
    let total = (ano * 2 + (sem - 1)) + (qtd - 1);
    return { total: total, formatado: `${Math.floor(total / 2)}/${(total % 2) + 1}` };
}

function calcularPrazos() {
    const anoIng = parseInt(document.getElementById('ingressoAno').value);
    const semIng = parseInt(document.getElementById('ingressoSemestre').value);
    const ppcIng = document.getElementById('ppcIngresso').value;
    const tranc = parseInt(document.getElementById('trancamentos').value) || 0;
    const regra = REGRAS_PPC[ppcIng];

    if (!regra || isNaN(anoIng)) return;

    const pMin = somarSemestres(anoIng, semIng, regra.min + tranc);
    const pMaxSem = somarSemestres(anoIng, semIng, regra.max + tranc);
    const pMaxCom = somarSemestres(anoIng, semIng, Math.floor(regra.dil) + tranc);

    const semsPlan = Object.keys(plano).sort();
    const totalIngresso = (anoIng * 2 + (semIng - 1));
    let cursados = 0;

    if (semsPlan.length > 0) {
        const [aP, sP] = semsPlan[0].split('/').map(Number);
        cursados = (aP * 2 + (sP - 1)) - totalIngresso - tranc;
    }

    let faltantes = regra.max - (cursados < 0 ? 0 : cursados);

    const painel = document.getElementById('painelPrazos');
    painel.innerHTML = `
        <div class="card-prazo"><b>Mínimo Formatura</b>${pMin.formatado}</div>
        <div class="card-prazo"><b>Máximo Sem Dilação</b>${pMaxSem.formatado}</div>
        <div class="card-prazo"><b>Máximo Com Dilação</b>${pMaxCom.formatado}</div>
        <div class="card-prazo"><b>Semestres Cursados</b>${cursados < 0 ? 0 : cursados}</div>
        <div class="card-prazo"><b>Restantes p/ Limite</b>${faltantes < 0 ? 0 : faltantes}</div>
    `;
}

function renderizarTudo() {
    const ppcKey = `ppc_${document.getElementById('filtroPPC').value}`;
    const mapaPlano = {};
    Object.entries(plano).forEach(([s, c]) => c.forEach(id => mapaPlano[id] = s));

    const boxHist = document.getElementById('checklistObrigatorias');
    boxHist.innerHTML = '';
    const semestresData = {};
    obrig.forEach(d => { if(d[ppcKey]) { (semestresData[d[ppcKey]] = semestresData[d[ppcKey]] || []).push(d); } });

    Object.keys(semestresData).sort((a,b)=>a-b).forEach(s => {
        const col = document.createElement('div'); col.className = 'coluna-semestre';
        col.innerHTML = `<h4>${s}º Semestre</h4>`;
        const lista = document.createElement('div'); lista.className = 'lista-disciplinas-vertical';

        semestresData[s].forEach(d => {
            const isChecked = cursadas.includes(d.codigo);
            const preReqCodes = d.prerequisitos || [];
            const cumpre = preReqCodes.every(p => cursadas.includes(p));
            const preReqNomes = preReqCodes.map(c => obrig.find(o => o.codigo === c)?.nome || c).join(', ');
            const plan = mapaPlano[d.codigo];

            const item = document.createElement('div');
            item.className = `item-check ${isChecked?'active':''} ${plan?'is-planned':''} ${!cumpre && !isChecked ? 'alerta-pre' : ''}`;
            item.innerHTML = `<div><strong>${d.codigo}</strong><br>${d.nome}
                ${plan?`<br><small>📅 Planejada: ${plan}</small>`:''}
                ${preReqNomes ? `<div class="tag-pre">Req: ${preReqNomes}</div>` : ''}</div>`;
            item.onclick = () => toggle(d.codigo);
            lista.appendChild(item);
        });
        col.appendChild(lista);
        boxHist.appendChild(col);
    });

    renderizarPendencias();
    renderizarGrade();
    calcularPrazos();
    localStorage.setItem('cursadas_ufmt', JSON.stringify(cursadas));
    localStorage.setItem('plano_ufmt', JSON.stringify(plano));
}

function renderizarPendencias() {
    const box = document.getElementById('listaDisponiveis');
    box.innerHTML = semestreAtivo ? '' : '<p style="padding:10px; color:red">Selecione um semestre no Plano para ver ofertas.</p>';
    if (!semestreAtivo) return;

    const jaMap = [...cursadas, ...Object.values(plano).flat()];
    const oferta = REGRAS_OFERTA[semestreAtivo];
    const [anoAtivo, periodoAtivo] = semestreAtivo.split('/').map(Number);

    obrig.filter(d => {
        if (jaMap.includes(d.codigo)) return false;

        let ofertada = false;
        if (oferta) {
            if (d.ppc_20261 && oferta["20261"].includes(d.ppc_20261)) ofertada = true;
            if (d.ppc_20251 && oferta["20251"].includes(d.ppc_20251)) ofertada = true;
        } else if (anoAtivo >= 2030) {
            const semD = d.ppc_20261;
            if (semD && ((periodoAtivo === 1 && semD % 2 !== 0) || (periodoAtivo === 2 && semD % 2 === 0))) ofertada = true;
        }
        return ofertada;
    }).forEach(d => {
        const preReqCodes = d.prerequisitos || [];
        const cumpre = preReqCodes.every(p => cursadas.includes(p));
        const preReqNomes = preReqCodes.map(c => obrig.find(o => o.codigo === c)?.nome || c).join(', ');

        const div = document.createElement('div');
        div.className = `mini-card ${!cumpre ? 'alerta-pre' : ''}`;
        div.innerHTML = `<div style="flex:1"><b>${d.codigo}</b><br>${d.nome}
            ${preReqNomes ? `<div class="tag-pre">Req: ${preReqNomes}</div>` : ''}</div>
            <button onclick="addAoPlano('${d.codigo}')" class="btn-primary" style="padding:5px; width:50px; font-size:0.6rem">ADD</button>`;
        box.appendChild(div);
    });
}

function renderizarGrade() {
    const box = document.getElementById('gradeSemestres'); box.innerHTML = '';
    Object.entries(plano).sort().forEach(([sem, cods]) => {
        const col = document.createElement('div');
        col.className = `coluna-semestre ${sem===semestreAtivo?'semestre-selecionado':''}`;
        col.onclick = () => { semestreAtivo = sem; renderizarTudo(); };
        let crTotal = 0;
        const lista = document.createElement('div');
        cods.forEach(c => {
            const d = obrig.find(x=>x.codigo===c);
            if(d) {
                crTotal += (parseInt(d.carga_horaria) || 0) / 16;
                const item = document.createElement('div'); item.className = 'card-disciplina';
                item.innerHTML = `<span style="flex:1"><b>${c}</b><br><small>${d.nome}</small></span><b onclick="event.stopPropagation(); delDisc('${sem}','${c}')" style="color:red; cursor:pointer">×</b>`;
                lista.appendChild(item);
            }
        });
        col.innerHTML = `<h4>${sem} <span class="badge-creditos">${crTotal} CR</span> <span onclick="event.stopPropagation(); removerSemestre('${sem}')">🗑️</span></h4>`;
        col.appendChild(lista);
        box.appendChild(col);
    });
}

function toggle(c) {
    if(cursadas.includes(c)) cursadas = cursadas.filter(x=>x!==c);
    else { cursadas.push(c); Object.keys(plano).forEach(s => plano[s] = plano[s].filter(id => id !== c)); }
    renderizarTudo();
}
function addAoPlano(c) { if(semestreAtivo) { plano[semestreAtivo].push(c); renderizarTudo(); } }
function delDisc(s, c) { plano[s] = plano[s].filter(x=>x!==c); renderizarTudo(); }
function removerSemestre(s) { if(confirm(`Remover semestre ${s}?`)) { delete plano[s]; if(semestreAtivo===s) semestreAtivo = ""; renderizarTudo(); } }
function addSemestre() {
    let sems = Object.keys(plano).sort();
    let n = sems.length ? somarSemestres(parseInt(sems[sems.length-1].split('/')[0]), parseInt(sems[sems.length-1].split('/')[1]), 2).formatado : prompt("Início (Ex: 2026/1)");
    if(n && !plano[n]) { plano[n] = []; semestreAtivo = n; renderizarTudo(); }
}
function salvarInfoAdicional() {
    const info = { nome: document.getElementById('alunoNome').value, sei: document.getElementById('alunoSEI').value, anoIng: document.getElementById('ingressoAno').value, semIng: document.getElementById('ingressoSemestre').value, ppcIng: document.getElementById('ppcIngresso').value, tranc: document.getElementById('trancamentos').value };
    localStorage.setItem('info_aluno_ufmt', JSON.stringify(info));
    calcularPrazos();
}
function carregarInfoAdicional() {
    const info = JSON.parse(localStorage.getItem('info_aluno_ufmt'));
    if (info) {
        document.getElementById('alunoNome').value = info.nome || "";
        document.getElementById('alunoSEI').value = info.sei || "";
        document.getElementById('ingressoAno').value = info.anoIng || "2022";
        document.getElementById('ingressoSemestre').value = info.semIng || "1";
        document.getElementById('ppcIngresso').value = info.ppcIng || "2026";
        document.getElementById('trancamentos').value = info.tranc || "0";
    }
    calcularPrazos();
}
function importarJSON(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const d = JSON.parse(ev.target.result);
        localStorage.setItem('cursadas_ufmt', JSON.stringify(d.cursadas || []));
        localStorage.setItem('plano_ufmt', JSON.stringify(d.plano || {}));
        localStorage.setItem('info_aluno_ufmt', JSON.stringify(d.info || d.infoAluno || {}));
        cursadas = d.cursadas || [];
        plano = d.plano || {};
        carregarInfoAdicional();
        renderizarTudo();
        alert("Importado!");
    };
    reader.readAsText(e.target.files[0]);
}
function exportarJSON() {
    const nomeRaw = document.getElementById('alunoNome').value || "aluno";
    const nomeFormatado = nomeRaw.toLowerCase().replace(/\s/g, "_");

    const dados = {
        cursadas,
        plano,
        info: JSON.parse(localStorage.getItem('info_aluno_ufmt'))
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], {type:'application/json'});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `plano_estudos_${nomeFormatado}.json`;
    a.click();
}

function exportarExcel() {
    const nomeRaw = document.getElementById('alunoNome').value || "aluno";
    const nomeFormatado = nomeRaw.toLowerCase().replace(/\s/g, "_");

    let csv = `CÓDIGO;CARGA HORÁRIA;NOME;Ano;Semestre\n`;
    Object.keys(plano).sort().forEach(s => {
        const [ano, sem] = s.split('/');
        plano[s].forEach((c, i) => {
            const d = obrig.find(x => x.codigo === c);
            if(d) csv += `${c};${d.carga_horaria};${d.nome};${i===0?ano:""};${i===0?sem:""}\n`;
        });
        csv += `;;;;\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `plano_estudos_${nomeFormatado}.csv`;
    a.click();
}
function gerarPDF() {
    const nomeRaw = document.getElementById('alunoNome').value || "aluno";
    const nomeFormatado = nomeRaw.toLowerCase().replace(/\s/g, "_");
    const tituloOriginal = document.title;

    document.title = `plano_estudos_${nomeFormatado}`; // O navegador usa isso como nome do arquivo PDF
    window.print();
    document.title = tituloOriginal; // Restaura o título original após abrir a tela de impressão
}
function limparDados() { if(confirm("Resetar?")) { localStorage.clear(); location.reload(); } }

carregar();