const URL = "./metadata/";
let currentFacingMode = "user";
let lastUpdateTime = 0;
let loopStarted = false;
let selectedImageElement = null;
let model, webcam, labelContainer, maxPredictions;

async function loadModel() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
    labelContainer = document.getElementById("label-container");
}

async function init() {
    await loadModel();
    if (webcam) {
        await webcam.stop();
    }
    
    const flip = (currentFacingMode === "user");
    webcam = new tmImage.Webcam(200, 200, flip);
    await webcam.setup({ facingMode: currentFacingMode });
    await webcam.play();

    if (!loopStarted) {
        loopStarted = true;
        window.requestAnimationFrame(loop);
    }

    const container = document.getElementById("webcam-container");
    container.innerHTML = "";
    container.appendChild(webcam.canvas);
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    updateCameraButtons(true);
}

async function switchCamera() {
    if (!webcam) return;
    currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
    await webcam.stop();
    const flip = (currentFacingMode === "user");
    webcam = new tmImage.Webcam(200, 200, flip);
    await webcam.setup({ facingMode: currentFacingMode });
    await webcam.play();
    const container = document.getElementById("webcam-container");
    container.innerHTML = "";
    container.appendChild(webcam.canvas);
}

async function stopCamera() {
    if (webcam) {
        await webcam.stop();
        webcam = null;
    }
    const container = document.getElementById("webcam-container");
    container.innerHTML = "";
    updateCameraButtons(false);
}

function updateCameraButtons(isRunning) {
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    if (!startBtn || !stopBtn) return;
    startBtn.disabled = isRunning;
    stopBtn.disabled = !isRunning;
}

async function loop() {
    try {
        if (webcam && webcam.canvas && webcam.canvas.width > 0) {
            webcam.update();
            await predict();
        }
    } catch (error) {
        console.error("Inference loop crash prevented:", error);
    } finally {
        if (loopStarted) {
            window.requestAnimationFrame(loop);
        }
    }
}

function predictClass(prediction) {
    if (!labelContainer) {
        labelContainer = document.getElementById("label-container");
    }
    const { bestClass, highestProb, statusColor } = getBestPrediction(prediction);
    labelContainer.innerHTML = renderResultCard(bestClass, highestProb, statusColor);
}

function getBestPrediction(prediction) {
    let highestProb = 0;
    let bestClass = "";

    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            bestClass = prediction[i].className;
        }
    }

    const normalizedClass = bestClass.toLowerCase();
    let statusColor = "#95a5a6";

    if (normalizedClass.includes("feliz") || normalizedClass.includes("happy")) {
        statusColor = "#2ecc71";
    } else if (normalizedClass.includes("neutro") || normalizedClass.includes("neutral")) {
        statusColor = "#3498db";
    }

    return { bestClass, highestProb, statusColor };
}

function renderResultCard(bestClass, highestProb, statusColor) {
    return `
        <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; border-left: 5px solid ${statusColor}">
            <strong>RESULTADO:</strong>
            <h2 style="color: ${statusColor}; margin: 5px 0;">${bestClass.toUpperCase()}</h2>
            <small>Confiança: ${(highestProb * 100).toFixed(2)}%</small>
        </div>`;
}

async function predict() {
    if (!model || !webcam || !webcam.canvas) return;
    const now = Date.now();
    
    // Throttling movido para evitar sobrecarga do processo de inferência
    if (now - lastUpdateTime > 1000) {
        const prediction = await model.predict(webcam.canvas);
        predictClass(prediction);
        lastUpdateTime = now; 
    }
}

function handleFileSelection() {
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('file-preview-container');
    const fileResult = document.getElementById('file-result');
    const verifyFileBtn = document.getElementById('verifyFileBtn');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            previewContainer.innerHTML = `<img id="target-image" src="${e.target.result}" width="200" style="border-radius: 8px;">`;
            selectedImageElement = document.getElementById('target-image');
            selectedImageElement.onload = () => {
                verifyFileBtn.disabled = false;
                fileResult.innerHTML = `
                    <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; border-left: 5px solid #3498db;">
                        <strong>ARQUIVO CARREGADO:</strong>
                        <small> Clique em <strong>Verificar Imagem</strong> para classificar.</small>
                    </div>`;
            };
        };

        reader.readAsDataURL(fileInput.files[0]);
    } else {
        verifyFileBtn.disabled = true;
        selectedImageElement = null;
        fileResult.innerHTML = "";
    }
}

async function verifySelectedFile() {
    const fileResult = document.getElementById('file-result');

    if (!selectedImageElement) {
        fileResult.innerHTML = `
            <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; border-left: 5px solid #e67e22;">
                <strong>ATENÇÃO:</strong>
                <small> Selecione uma imagem antes de verificar.</small>
            </div>`;
        return;
    }

    await runStaticPrediction(selectedImageElement, true);
}

async function runStaticPrediction(imgElement, showInFileResult = false) {
    if (model == null) 
        await loadModel();
     
    const prediction = await model.predict(imgElement);

    if (showInFileResult) {
        const { bestClass, highestProb, statusColor } = getBestPrediction(prediction);
        const fileResult = document.getElementById('file-result');
        fileResult.innerHTML = renderResultCard(bestClass, highestProb, statusColor);
    }
}
