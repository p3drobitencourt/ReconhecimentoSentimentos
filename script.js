// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image

// the link to your model provided by Teachable Machine export panel
const URL = "./metadata/";
let currentFacingMode = "user"; // Começa
//  com a frontal
let lastUpdateTime = 0;
let loopStarted = false;
let selectedImageElement = null;
let model, webcam, labelContainer, maxPredictions;

/**
 * Carrega o modelo e metadados
 */
async function loadModel() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    // load the model and metadata
    // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
    // or files from your local hard drive
    // Note: the pose library adds "tmImage" object to your window (window.tmImage)
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
    labelContainer = document.getElementById("label-container");
}

// Load the image model and setup the webcam
async function init() {
    await loadModel();

    if (webcam) {
        await webcam.stop();
    }

    // Convenience function to setup a webcam
    const flip = (currentFacingMode === "user");
    webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
    await webcam.setup({ facingMode: currentFacingMode }); // request access to the webcam
    await webcam.play();

    if (!loopStarted) {
        loopStarted = true;
        window.requestAnimationFrame(loop);
    }

    // append elements to the DOM
    const container = document.getElementById("webcam-container");
    container.innerHTML = "";
    container.appendChild(webcam.canvas);
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    updateCameraButtons(true);
}

/**
 * Alterna entre câmera frontal e traseira
 */
async function switchCamera() {
    if (webcam) {
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
    if (webcam && webcam.canvas) {
        webcam.update(); // update the webcam frame
        await predict();
    }
    window.requestAnimationFrame(loop);
}

/**
 * Função: Classifica a predição e exibe o resultado com cor
 * @param {Array} prediction - Array de predições do modelo
 */
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

// run the webcam image through the image model
async function predict() {
    // predict can take in an image, video or canvas html element
    if (!model || !webcam) return;
    
    const now = Date.now();
    const prediction = await model.predict(webcam.canvas);
    if (now - lastUpdateTime > 1000) {
        predictClass(prediction);
        lastUpdateTime = now; // Atualiza o marcador de tempo
    }
}

/**
 * Função: Processa arquivo de imagem selecionado
 */
async function predictFromFile() {
    await verifySelectedFile();
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

/**
 * Função: Executa a predição em um elemento de imagem estático
 * @param {HTMLImageElement} imgElement 
 */
async function runStaticPrediction(imgElement, showInFileResult = false) {
    if (model == null) 
        await loadModel();
     
    const prediction = await model.predict(imgElement);
    predictClass(prediction);

    if (showInFileResult) {
        const { bestClass, highestProb, statusColor } = getBestPrediction(prediction);
        const fileResult = document.getElementById('file-result');
        fileResult.innerHTML = renderResultCard(bestClass, highestProb, statusColor);
    }
}