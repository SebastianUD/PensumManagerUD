document.addEventListener('DOMContentLoaded', () => {
    // === CONFIG & CONSTANTS ===
    const TOTAL_CREDITS_CAREER = 150; // As per the image
    const STATES = ['no-cursada', 'en-curso', 'aprobada'];
    const CONTAINER_ID = 'malla-curricular';
    const LOCAL_STORAGE_KEY = 'pensum_manager_states';

    // === DOM ELEMENTS ===
    const container = document.getElementById(CONTAINER_ID);
    const approvedEl = document.getElementById('creditos-aprobados');
    const pendingEl = document.getElementById('creditos-pendientes');
    const enCursoEl = document.getElementById('creditos-en-curso');
    const progressEl = document.getElementById('porcentaje-avance');
    const averageEl = document.getElementById('promedio-semestral');
    const semestresInput = document.getElementById('matriculas-restantes');

    // Modal Elements
    const modal = document.getElementById('pdf-modal');
    const modalCloseBtn = document.getElementById('close-modal');
    const pdfFrame = document.getElementById('pdf-frame');
    const noPdfMsg = document.getElementById('no-pdf-message');
    const modalTitle = document.getElementById('modal-title');

    // === INITIALIZATION ===
    let subjectStates = loadStates();
    init();

    function init() {
        // Synchronize in-memory pensum with saved states
        pensum.forEach(subject => {
            const savedState = subjectStates[subject.id];
            if (savedState) {
                subject.estado = savedState;
            }
        });

        renderGrid();
        updateStats();

        // Listeners
        semestresInput.addEventListener('input', updateStats);
        modalCloseBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // === STATE MANAGEMENT ===
    function loadStates() {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    }

    function saveStates() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(subjectStates));
    }

    function getSubjectState(id) {
        return subjectStates[id] || 'no-cursada';
    }

    function cycleState(id) {
        const currentState = getSubjectState(id);
        const currentIndex = STATES.indexOf(currentState);
        const nextIndex = (currentIndex + 1) % STATES.length;
        setSubjectState(id, STATES[nextIndex]);
    }

    function resetState(id) {
        setSubjectState(id, 'no-cursada');
    }

    function setSubjectState(id, nextState) {

        subjectStates[id] = nextState;
        saveStates();

        // Update in-memory pensum
        const subject = pensum.find(s => s.id === id);
        if (subject) {
            subject.estado = nextState;
        }

        updateCardVisuals(id, nextState);
        updateStats();
    }

    // === RENDERING ===
    function renderGrid() {
        container.innerHTML = '';

        // Determine max levels (usually 1-9)
        const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9];

        levels.forEach(level => {
            const column = document.createElement('div');
            column.className = 'level-column';

            const header = document.createElement('div');
            header.className = 'level-header';
            header.textContent = `Nivel ${level}`;
            column.appendChild(header);

            // Filter subjects for this level
            const subjects = pensum.filter(s => s.nivel === level);

            subjects.forEach(subject => {
                const card = createCard(subject);
                column.appendChild(card);
            });

            container.appendChild(column);
        });
    }

    function createCard(subject) {
        const card = document.createElement('div');
        card.className = `subject-card state-${getSubjectState(subject.id)}`;
        card.dataset.id = subject.id;

        // On click body -> cycle state
        card.addEventListener('click', (e) => {
            // Prevent triggering if clicked on PDF button
            if (e.target.closest('.pdf-btn')) return;
            cycleState(subject.id);
        });

        // On right click -> reset state
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent default browser context menu
            resetState(subject.id);
        });

        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `<span>Cod: ${subject.id || 'N/A'}</span>`;

        const name = document.createElement('div');
        name.className = 'subject-name';
        name.textContent = subject.nombre;
        name.title = subject.nombre; // Tooltip

        const footer = document.createElement('div');
        footer.className = 'card-footer';

        const credits = document.createElement('span');
        credits.className = 'credits-badge';
        credits.textContent = `${subject.creditos} Cr`;

        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'pdf-btn';
        pdfBtn.innerHTML = '<ion-icon name="document-text-outline"></ion-icon>';
        pdfBtn.title = 'Ver Syllabus';
        pdfBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(subject);
        });

        footer.appendChild(credits);
        // Only show PDF button if subject has a syllabus path or code (some logic in request said 'no code = no pdf')
        // We will respect the 'syllabus' property from data.js
        if (subject.syllabus) {
            footer.appendChild(pdfBtn);
        }

        card.appendChild(header);
        card.appendChild(name);
        card.appendChild(footer);

        return card;
    }

    function updateCardVisuals(id, newState) {
        // Find card by dataset
        const card = document.querySelector(`.subject-card[data-id="${id}"]`);
        if (card) {
            // Remove all state classes
            STATES.forEach(s => card.classList.remove(`state-${s}`));
            // Add new state class
            card.classList.add(`state-${newState}`);
        }
    }

    // === STATISTICS ===
    function updateStats() {
        let approved = 0;
        let inProgress = 0;

        // Interpretation:
        // Creditos Aprobados = Sum(Aprobada)
        // Creditos Restantes = Total Career - Creditos Aprobados
        // (En Curso subjects are effectively 'Restantes' until they become 'Aprobada')

        pensum.forEach(subject => {
            const state = getSubjectState(subject.id);
            if (state === 'aprobada') {
                approved += subject.creditos;
            } else if (state === 'en-curso') {
                inProgress += subject.creditos;
            }
        });

        const pending = TOTAL_CREDITS_CAREER - approved;
        const progress = (approved / TOTAL_CREDITS_CAREER) * 100;

        // Matriculas logic
        const semestresRestantes = parseInt(semestresInput.value) || 1;
        const average = pending / semestresRestantes;

        // Update DOM
        animateValue(approvedEl, parseInt(approvedEl.textContent), approved, 500);
        animateValue(pendingEl, parseInt(pendingEl.textContent), pending, 500);
        animateValue(enCursoEl, parseInt(enCursoEl.textContent), inProgress, 500);
        progressEl.textContent = `${progress.toFixed(1)}%`;
        averageEl.textContent = average.toFixed(1);
    }

    function animateValue(obj, start, end, duration) {
        if (start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // === MODAL LOGIC ===
    function openModal(subject) {
        modalTitle.textContent = subject.nombre;

        if (subject.syllabus) {
            pdfFrame.src = subject.syllabus;
            pdfFrame.classList.remove('hidden');
            noPdfMsg.classList.add('hidden');
        } else {
            pdfFrame.src = '';
            pdfFrame.classList.add('hidden');
            noPdfMsg.classList.remove('hidden');
        }

        modal.classList.add('active');
    }

    function closeModal() {
        modal.classList.remove('active');
        pdfFrame.src = ''; // Stop loading
    }
});
