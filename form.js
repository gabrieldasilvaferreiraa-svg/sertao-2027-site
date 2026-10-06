(() => {
  const form = document.getElementById('applicationForm');
  if (!form) return;

  const steps = [...form.querySelectorAll('.form-step')];
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const submitBtn = document.getElementById('submitBtn');
  const stepLabel = document.getElementById('stepLabel');
  const stepTitle = document.getElementById('stepTitle');
  const progressBar = document.getElementById('progressBar');
  const message = document.getElementById('formMessage');
  const statusText = document.getElementById('formStatus');
  const groupInput = document.getElementById('grupo');
  const groupResult = document.getElementById('groupResult');

  const titles = ['Seu grupo','Sobre você','Sua igreja e liderança','Experiência missionária','Documentos e confirmações'];
  const openAt = new Date('2026-10-01T00:00:00-03:00');
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  let current = 0;

  function registrationOpen() {
    return preview || new Date() >= openAt;
  }

  function setStep(index) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((s,i) => s.classList.toggle('active', i === current));
    stepLabel.textContent = `Etapa ${current + 1} de ${steps.length}`;
    stepTitle.textContent = titles[current];
    progressBar.style.width = `${((current + 1) / steps.length) * 100}%`;
    prevBtn.hidden = current === 0;
    nextBtn.hidden = current === steps.length - 1;
    submitBtn.hidden = current !== steps.length - 1;
    window.requestAnimationFrame(() => {
      form.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  function validateStep(step) {
    const required = [...step.querySelectorAll('[required]')];
    for (const field of required) {
      if (field.type === 'radio') {
        const group = step.querySelectorAll(`input[name="${field.name}"]`);
        if (![...group].some(r => r.checked)) {
          field.setCustomValidity('Selecione uma opção.');
          field.reportValidity();
          field.setCustomValidity('');
          return false;
        }
      } else if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  form.querySelectorAll('input[name="ja_participou_sertao"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const veteran = radio.value === 'Sim';
      groupInput.value = veteran ? 'Grupo 02 - Veteranos' : 'Grupo 01 - Novatos';
      groupResult.hidden = false;
      groupResult.innerHTML = veteran
        ? '<b>Grupo 02 · Veteranos</b><span>11 a 21 de fevereiro de 2027 · 14 vagas</span>'
        : '<b>Grupo 01 · Novatos</b><span>21 de janeiro a 01 de fevereiro de 2027 · 14 vagas</span>';
    });
  });

  nextBtn.addEventListener('click', () => {
    if (validateStep(steps[current])) setStep(current + 1);
  });
  prevBtn.addEventListener('click', () => setStep(current - 1));

  function cleanObject(fd) {
    const data = {};
    for (const [key,value] of fd.entries()) data[key] = typeof value === 'string' ? value.trim() : value;
    ['confirma_congrega','confirma_lideranca','confirma_treinamentos','confirma_logistica','confirma_valores','consentimento_dados']
      .forEach(k => data[k] = fd.has(k));
    data.origem = 'site-sertao-2027';
    data.user_agent = navigator.userAgent.slice(0, 300);
    return data;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.className = 'form-message';
    message.textContent = '';

    if (!registrationOpen()) {
      message.classList.add('error');
      message.textContent = 'As inscrições abrem em 01/10/2026.';
      return;
    }
    if (!validateStep(steps[current]) || !form.checkValidity()) return;

    const cfg = window.SERTAO_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      message.classList.add('error');
      message.textContent = 'O formulário está em fase final de configuração. Tente novamente em alguns minutos.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const payload = cleanObject(new FormData(form));

      const sendRegistration = () => fetch(`${cfg.supabaseUrl}/rest/v1/rpc/enviar_inscricao_sertao`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':cfg.supabaseAnonKey,
          'Authorization':`Bearer ${cfg.supabaseAnonKey}`
        },
        body:JSON.stringify({payload})
      });

      let response;
      try {
        response = await sendRegistration();
      } catch (networkError) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        response = await sendRegistration();
      }

      if (response.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        response = await sendRegistration();
      }

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || body?.details || 'SUBMIT_ERROR');
      }

      const result = typeof body === 'string' ? body : String(body || '');
      const alreadyExists = result === 'already_exists';

      form.innerHTML = `
        <div class="success-card">
          <span>${alreadyExists ? 'PRÉ-INSCRIÇÃO JÁ RECEBIDA' : 'PRÉ-INSCRIÇÃO RECEBIDA'}</span>
          <h3>${alreadyExists ? 'Sua inscrição já consta no sistema.' : `Obrigado, ${payload.nome_completo.split(' ')[0]}.`}</h3>
          <p>Sua pré-inscrição está registrada para <b>${payload.grupo}</b>.</p>
          <p>${alreadyExists ? 'Não é necessário enviar novamente.' : 'Sua pré-inscrição foi recebida com sucesso.'}</p>
          <p>A equipe da IDE Missões analisará as respostas e entrará em contato pelo WhatsApp informado. A vaga só é confirmada após aprovação e pagamento do sinal.</p>
        </div>`;
    } catch (err) {
      message.classList.add('error');
      message.textContent = 'Não conseguimos concluir o envio neste momento. Seus dados continuam preenchidos. Aguarde alguns segundos e tente novamente.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar pré-inscrição';
      console.error(err);
    }
  });

  if (!registrationOpen()) {
    statusText.textContent = 'As inscrições abrem em 01/10/2026, à 00h no horário de Brasília.';
    submitBtn.disabled = true;
    submitBtn.title = 'Inscrições ainda não abertas';
  } else {
    statusText.textContent = 'Inscrições abertas enquanto houver vagas. Quando as 14 vagas confirmadas de um grupo forem preenchidas, novas inscrições elegíveis entram na lista de espera.';
  }

  setStep(0);
})();