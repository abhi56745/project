'use strict';

const app = (() => {
    // =========================================================================
    // STATE & CONSTANTS
    // =========================================================================
    let state = {
        tasks: [],
        stats: { pomodoroSessions: 0, lastReset: new Date().toDateString() },
        stopwatch: { running: false, elapsedTime: 0, startTime: 0, interval: null },
        timer: { running: false, isWorkSession: true, initialDuration: 25 * 60 * 1000, deadline: 0, remainingTime: 25 * 60 * 1000, interval: null },
        ui: { activeTab: 'tasks', isFocusMode: false, isDarkMode: false, draggingIndex: null }
    };

    const quotes = [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    ];
    const notificationSound = new Audio('data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaW5nIGNyZWF0ZWQgYnkgVGhlIE1hZ2ljIEJpbmdvbiBuYW1lZCBsb3AucmFmYWVsbEBnbWFpbC5jb20AVFNTRQAAAA8AAANMYXZmNTguNzYuMTAwVVJMIHhodHRwczovL2Jpbmdvbi5jb20vAACYTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');

    // =========================================================================
    // DOM & UTILITIES
    // =========================================================================
    const DOMElements = {
        body: document.body,
        get: (id) => document.getElementById(id),
        getAll: (selector) => document.querySelectorAll(selector),
        modal: {
            overlay: document.getElementById('confirmationModal'),
            message: document.getElementById('modal-message'),
            confirmBtn: document.getElementById('modal-confirm-btn'),
            cancelBtn: document.getElementById('modal-cancel-btn')
        }
    };

    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    function formatTime(ms, showHours = true) {
        if (ms < 0) ms = 0;
        const totalSeconds = Math.round(ms / 1000);
        const secs = String(totalSeconds % 60).padStart(2, '0');
        const mins = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0');
        if (!showHours) return `${mins}:${secs}`;
        const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    // =========================================================================
    // UI MODULE
    // =========================================================================
    function renderTasks(searchTerm = '') {
        const taskList = DOMElements.get('taskList');
        // This clear-and-re-render approach is simple and efficient enough for this app's scale.
        taskList.innerHTML = '';
        const filteredTasks = state.tasks.filter(task => task.text.toLowerCase().includes(searchTerm.toLowerCase()));

        if (state.tasks.length === 0) {
            taskList.innerHTML = `<div class="empty-state-message">Your task list is empty. <br> Add one above to get started!</div>`;
            return;
        }
        if (filteredTasks.length === 0) {
            taskList.innerHTML = `<div class="empty-state-message">No tasks match your search.</div>`;
            return;
        }

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `priority-${task.priority}`;
            li.setAttribute('data-id', task.id);
            li.setAttribute('draggable', true);
            if (task.completed) li.classList.add('completed');
            li.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} data-action="toggle" aria-label="Toggle task: ${task.text}">
                <span>${task.text}</span>
                <button class="delete-task-btn" data-action="delete" aria-label="Delete task: ${task.text}">🗑️</button>
            `;
            taskList.appendChild(li);
        });
        updateStats();
    }
    
    function showToast(message, isError = false) {
        const toast = DOMElements.get('toast');
        if(!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${isError ? 'error' : ''}`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
    
    function showConfirmationModal(message, onConfirm) {
        const { overlay, message: msgElem, confirmBtn, cancelBtn } = DOMElements.modal;
        msgElem.textContent = message;
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('visible');

        const cleanup = () => {
            overlay.setAttribute('aria-hidden', 'true');
            overlay.classList.remove('visible');
            // Clone and replace the buttons to remove all event listeners cleanly
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };
        
        // Re-get the buttons after cloning to attach new listeners
        const newConfirmBtn = document.getElementById('modal-confirm-btn');
        const newCancelBtn = document.getElementById('modal-cancel-btn');

        newConfirmBtn.onclick = () => {
            onConfirm();
            cleanup();
        };
        newCancelBtn.onclick = cleanup;
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
            }
        };
    }

    function updateStats() {
        if (new Date().toDateString() !== state.stats.lastReset) {
            state.stats = { pomodoroSessions: 0, lastReset: new Date().toDateString() };
        }
        const completedTasks = state.tasks.filter(t => t.completed).length;
        const totalTasks = state.tasks.length;
        const taskPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        DOMElements.get('tasks-ring').style.setProperty('--value', taskPercent);
        DOMElements.get('tasks-ring-value').textContent = `${completedTasks}/${totalTasks}`;
        const pomoPercent = Math.min(100, (state.stats.pomodoroSessions / 4) * 100);
        DOMElements.get('pomodoro-ring').style.setProperty('--value', pomoPercent);
        DOMElements.get('pomodoro-ring-value').textContent = state.stats.pomodoroSessions;
    }

    function applyTheme() {
        if (state.ui.isDarkMode) {
            DOMElements.body.classList.add('dark-mode');
            DOMElements.get('theme-switch-checkbox').checked = true;
        } else {
            DOMElements.body.classList.remove('dark-mode');
            DOMElements.get('theme-switch-checkbox').checked = false;
        }
    }

    function showTab(tabId) {
        state.ui.activeTab = tabId;
        DOMElements.getAll('.tab').forEach(tab => tab.classList.remove('active'));
        DOMElements.getAll('nav.tab-buttons button').forEach(btn => btn.classList.remove('active-tab'));
        DOMElements.get(tabId).classList.add('active');
        DOMElements.get(`tab-btn-${tabId}`).classList.add('active-tab');
    }

    function updateClock() {
        const now = new Date();
        DOMElements.get('time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        DOMElements.get('date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }

    function rotateQuotes() {
        const quoteCard = DOMElements.get('quote-card');
        const quoteText = DOMElements.get('quote-text');
        const quoteAuthor = DOMElements.get('quote-author');
        const setQuote = () => {
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            quoteCard.classList.add('fade-out');
            setTimeout(() => {
                quoteText.textContent = `“${randomQuote.text}”`;
                quoteAuthor.textContent = `— ${randomQuote.author}`;
                quoteCard.classList.remove('fade-out');
            }, 500);
        };
        setQuote();
        setInterval(setQuote, 10000);
    }
    
    function fetchWeather() {
        const weatherInfo = DOMElements.get('weather-info');
        if (!navigator.geolocation) {
            weatherInfo.textContent = "Geolocation is not supported.";
            return;
        }
        navigator.geolocation.getCurrentPosition(
          () => {
             const mockWeathers = [{ temp: "28°C", condition: "Sunny ☀️" }, { temp: "22°C", condition: "Cloudy ☁️" }];
             const randomWeather = mockWeathers[Math.floor(Math.random() * mockWeathers.length)];
             weatherInfo.textContent = `${randomWeather.temp}, ${randomWeather.condition}`;
          }, 
          () => { weatherInfo.textContent = "Unable to retrieve location."; }
        );
    }

    function showNotification(title, body) {
        notificationSound.play().catch(e => console.error("Error playing sound:", e));
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        new Notification(title, { body });
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================
    function saveState() {
        const stateToSave = {
            tasks: state.tasks,
            stats: state.stats,
            ui: { activeTab: state.ui.activeTab, isDarkMode: state.ui.isDarkMode }
        };
        localStorage.setItem('productivityToolkitState', JSON.stringify(stateToSave));
    }

    function loadState() {
        const savedState = JSON.parse(localStorage.getItem('productivityToolkitState'));
        if (!savedState) return;
        state.tasks = savedState.tasks?.map(t => ({...t, priority: t.priority || 'medium'})) || [];
        state.stats = savedState.stats || { pomodoroSessions: 0, lastReset: new Date().toDateString() };
        state.ui.activeTab = savedState.ui?.activeTab || 'tasks';
        state.ui.isDarkMode = savedState.ui?.isDarkMode || false;
    }

    // =========================================================================
    // TASK MODULE
    // =========================================================================
    function addTask() {
        const input = DOMElements.get('taskInput');
        const prioritySelect = DOMElements.get('taskPriority');
        const text = input.value.trim();
        if (!text) {
            showToast("Task cannot be empty.", true);
            return;
        }
        state.tasks.unshift({ id: Date.now(), text, completed: false, priority: prioritySelect.value });
        saveState();
        renderTasks();
        input.value = '';
        input.focus();
        showToast("Task added successfully!");
    }

    function handleTaskClick(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        const taskId = Number(e.target.closest('li').dataset.id);
        const taskIndex = state.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;

        if (action === 'toggle') {
            state.tasks[taskIndex].completed = !state.tasks[taskIndex].completed;
        } else if (action === 'delete') {
            showConfirmationModal("Are you sure you want to permanently delete this task?", () => {
                state.tasks.splice(taskIndex, 1);
                showToast("Task deleted.");
                saveState();
                renderTasks(DOMElements.get('taskSearch').value);
            });
            return; // Return early to prevent double render
        }
        saveState();
        renderTasks(DOMElements.get('taskSearch').value);
    }
    
    // =========================================================================
    // TIMER MODULE
    // =========================================================================
    function updateTimerDisplay() {
        const remaining = state.timer.running ? state.timer.deadline - Date.now() : state.timer.remainingTime;
        DOMElements.get('timerDisplay').textContent = formatTime(remaining, false);
        document.title = `${formatTime(remaining, false)} - Productivity Toolkit`;
    }

    function timerTick() {
        const remaining = state.timer.deadline - Date.now();
        if (remaining <= 0) {
            const sessionWasWork = state.timer.isWorkSession;
            if (sessionWasWork) {
                state.stats.pomodoroSessions++;
                saveState();
                updateStats();
            }
            showNotification("Timer Finished!", `Your ${sessionWasWork ? 'work session' : 'break'} is over.`);
            setTimer(sessionWasWork ? 5 * 60 * 1000 : 25 * 60 * 1000, !sessionWasWork);
            startTimer(); // Auto-start the next session
        }
        updateTimerDisplay();
    }

    function startTimer() {
        if (state.timer.running) return;
        state.timer.running = true;
        state.timer.deadline = Date.now() + state.timer.remainingTime;
        state.timer.interval = setInterval(timerTick, 1000);
    }

    function pauseTimer() {
        if (!state.timer.running) return;
        state.timer.running = false;
        clearInterval(state.timer.interval);
        state.timer.remainingTime = state.timer.deadline - Date.now();
    }

    function resetTimer() {
        pauseTimer();
        setTimer(25 * 60 * 1000, true);
    }

    function setTimer(durationMs, isWorkSession) {
        pauseTimer();
        state.timer.initialDuration = durationMs;
        state.timer.remainingTime = durationMs;
        state.timer.isWorkSession = isWorkSession;
        updateTimerDisplay();
    }

    // =========================================================================
    // STOPWATCH MODULE
    // =========================================================================
    function updateStopwatchDisplay() {
        const elapsed = state.stopwatch.running ? (Date.now() - state.stopwatch.startTime) + state.stopwatch.elapsedTime : state.stopwatch.elapsedTime;
        DOMElements.get('timeDisplay').textContent = formatTime(elapsed);
    }

    function startStopwatch() {
        if (state.stopwatch.running) return;
        state.stopwatch.running = true;
        state.stopwatch.startTime = Date.now();
        state.stopwatch.interval = setInterval(updateStopwatchDisplay, 100);
    }

    function pauseStopwatch() {
        if (!state.stopwatch.running) return;
        state.stopwatch.running = false;
        clearInterval(state.stopwatch.interval);
        state.stopwatch.elapsedTime += Date.now() - state.stopwatch.startTime;
    }

    function resetStopwatch() {
        pauseStopwatch();
        state.stopwatch.elapsedTime = 0;
        updateStopwatchDisplay();
    }

    // =========================================================================
    // BMI CALCULATOR MODULE
    // =========================================================================
    function calculateBMI() {
        const weight = parseFloat(DOMElements.get('weight').value);
        const height = parseFloat(DOMElements.get('height').value);
        const resultDiv = DOMElements.get('bmiResult');
        resultDiv.className = 'bmiResult';
        if (!weight || !height || weight <= 0 || height <= 0) {
            resultDiv.textContent = 'Please enter valid weight and height.';
            return;
        }
        const bmi = weight / ((height / 100) ** 2);
        let status = '', className = '';
        if (bmi < 18.5) { status = 'Underweight'; className = 'bmi-underweight'; } 
        else if (bmi < 25) { status = 'Normal weight'; className = 'bmi-normal'; }
        else if (bmi < 30) { status = 'Overweight'; className = 'bmi-overweight'; }
        else { status = 'Obese'; className = 'bmi-obese'; }
        resultDiv.textContent = `BMI: ${bmi.toFixed(1)} (${status})`;
        resultDiv.classList.add(className);
    }

    // =========================================================================
    // MAIN APP & INITIALIZATION
    // =========================================================================
    function bindEvents() {
        // App Listeners
        window.addEventListener('beforeunload', saveState);
        DOMElements.get('theme-switch-checkbox').addEventListener('change', () => { state.ui.isDarkMode = !state.ui.isDarkMode; applyTheme(); saveState(); });
        DOMElements.get('focus-switch-checkbox').addEventListener('change', () => DOMElements.body.classList.toggle('focus-mode-active'));
        
        // Tab Listeners
        DOMElements.getAll('nav.tab-buttons button').forEach(button => button.addEventListener('click', () => showTab(button.getAttribute('aria-controls'))));
        
        // Task Listeners
        DOMElements.get('addTaskBtn').addEventListener('click', addTask);
        DOMElements.get('taskInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
        DOMElements.get('taskSearch').addEventListener('input', (e) => renderTasks(e.target.value));
        DOMElements.get('taskList').addEventListener('click', handleTaskClick);

        // Timer Listeners
        DOMElements.get('startTimerBtn').addEventListener('click', startTimer);
        DOMElements.get('pauseTimerBtn').addEventListener('click', pauseTimer);
        DOMElements.get('resetTimerBtn').addEventListener('click', () => showConfirmationModal("Reset the timer?", resetTimer));
        DOMElements.getAll('.timer-preset-btn').forEach(btn => btn.addEventListener('click', () => setTimer(Number(btn.dataset.minutes) * 60 * 1000, btn.dataset.minutes === "25")));
        DOMElements.get('setCustomTimerBtn').addEventListener('click', () => {
            const minutes = parseInt(DOMElements.get('customMinutes').value, 10);
            if (minutes > 0) setTimer(minutes * 60 * 1000, true);
            DOMElements.get('customMinutes').value = '';
        });

        // Stopwatch Listeners
        DOMElements.get('startStopwatchBtn').addEventListener('click', startStopwatch);
        DOMElements.get('pauseStopwatchBtn').addEventListener('click', pauseStopwatch);
        DOMElements.get('resetStopwatchBtn').addEventListener('click', () => showConfirmationModal("Reset the stopwatch?", resetStopwatch));
        
        // BMI Listener
        DOMElements.get('calculateBmiBtn').addEventListener('click', calculateBMI);

        // Notes & Data Listeners
        const debouncedSaveNotes = debounce(() => { localStorage.setItem('quickNotes', DOMElements.get('quickNotes').value); showToast("Notes saved!", false); }, 1000);
        DOMElements.get('quickNotes').addEventListener('keyup', debouncedSaveNotes);
        const importFileInput = DOMElements.get('importFileInput');
        DOMElements.get('importDataBtn').addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                showConfirmationModal("This will overwrite all current data. Are you sure?", () => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (importedData.tasks && importedData.stats) {
                            localStorage.setItem('productivityToolkitState', JSON.stringify(importedData));
                            location.reload();
                        } else { showToast("Invalid backup file format.", true); }
                    } catch (error) { showToast("Error reading file.", true); }
                });
            };
            reader.readAsText(file);
            event.target.value = '';
        });
        DOMElements.get('exportDataBtn').addEventListener('click', () => {
            saveState(); 
            const dataStr = localStorage.getItem('productivityToolkitState');
            if (!dataStr || JSON.parse(dataStr).tasks.length === 0) {
                showToast("Nothing to export.", true);
                return;
            }
            const dataBlob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `productivity-toolkit-backup-${new Date().toISOString().slice(0,10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            showToast("Data exported successfully!");
        });
    }

    function init() {
        loadState();
        if (localStorage.getItem('productivityToolkitState') === null) {
             state.ui.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        applyTheme();
        renderTasks();
        updateTimerDisplay();
        updateStopwatchDisplay();
        showTab(state.ui.activeTab);
        updateClock();
        setInterval(updateClock, 1000);
        rotateQuotes();
        fetchWeather();
        DOMElements.get('quickNotes').value = localStorage.getItem('quickNotes') || '';
        bindEvents();
        Notification.requestPermission();
    }
    
    return { init };
})();

document.addEventListener('DOMContentLoaded', app.init);