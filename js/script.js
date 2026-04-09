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

async function carregar() {
    try {
        const res = await fetch('./data/disciplinas_obrigatorias.json');
        obrig = await res.json();
        const sems = Object.keys(plano).sort();
        if (sems.length > 0) semestreAtivo = sems[sems.length - 1];
        carregarInfoAdicional();
        renderizarTudo();
    } catch (e) { console.error("Erro no carregamento."); }
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

    // Lógica correta: Máximo permitido menos os gastos.
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
    box.innerHTML = semestreAtivo ? '' : '<p style="padding:10px">Selecione um semestre.</p>';
    if (!semestreAtivo) return;
    const ja = [...cursadas, ...Object.values(plano).flat()];
    obrig.filter(d => !ja.includes(d.codigo)).forEach(d => {
        const preReqCodes = d.prerequisitos || [];
        const cumpre = preReqCodes.every(p => cursadas.includes(p));
        const preReqNomes = preReqCodes.map(c => obrig.find(o => o.codigo === c)?.nome || c).join(', ');
        const div = document.createElement('div');
        div.className = `mini-card ${!cumpre ? 'alerta-pre' : ''}`; // AMARELO SE NÃO CUMPRE REQ
        div.innerHTML = `<div style="flex:1"><b>${d.codigo}</b><br>${d.nome}
            ${preReqNomes ? `<div class="tag-pre">Req: ${preReqNomes}</div>` : ''}</div>
            <button onclick="addAoPlano('${d.codigo}')" class="btn-primary">ADD</button>`;
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
function exportarJSON() {
    const blob = new Blob([JSON.stringify({cursadas, plano, info: JSON.parse(localStorage.getItem('info_aluno_ufmt'))})], {type:'application/json'});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = 'plano_ufmt.json'; a.click();
}
function importarJSON(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const d = JSON.parse(ev.target.result);
        localStorage.setItem('cursadas_ufmt', JSON.stringify(d.cursadas || []));
        localStorage.setItem('plano_ufmt', JSON.stringify(d.plano || {}));
        localStorage.setItem('info_aluno_ufmt', JSON.stringify(d.info || {}));
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
}
function exportarExcel() {
    const nome = document.getElementById('alunoNome').value || "ALUNO";
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
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `PLANO_${nome.toUpperCase()}.csv`; a.click();
}
function gerarPDF() { window.print(); }
function limparDados() { if(confirm("Resetar todos os dados?")) { localStorage.clear(); location.reload(); } }

carregar();