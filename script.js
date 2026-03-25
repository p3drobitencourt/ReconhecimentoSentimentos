// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image

// the link to your model provided by Teachable Machine export panel
const URL = "./my_model/";
let currentFacingMode = "user"; // Começa
//  com a frontal
let lastUpdateTime = 0;
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

    // Convenience function to setup a webcam
    const flip = (currentFacingMode === "user");
    webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
    await webcam.setup({ facingMode: currentFacingMode }); // request access to the webcam
    await webcam.play();
    window.requestAnimationFrame(loop);

    // append elements to the DOM
    const container = document.getElementById("webcam-container");
    container.innerHTML = "";
    container.appendChild(webcam.canvas);
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
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
    let highestProb = 0;
    let bestClass = "";

    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            bestClass = prediction[i].className;
        }
    }

    let statusColor = "#2ecc71"; // Verde para "Com Máscara"
    if (bestClass.toLowerCase().includes("no") || bestClass.toLowerCase().includes("sem")) {
        statusColor = "#e74c3c"; // Vermelho para "Sem Máscara"
    }

    labelContainer.innerHTML = `
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
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('file-preview-container');
    
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();

        reader.onload = async function (e) {
            previewContainer.innerHTML = `<img id="target-image" src="${e.target.result}" width="200" style="border-radius: 8px;">`;
            const imgElement = document.getElementById('target-image');
            imgElement.onload = async () => {
                await runStaticPrediction(imgElement);
            };
        };

        reader.readAsDataURL(fileInput.files[0]);
    }
}

/**
 * Função: Executa a predição em um elemento de imagem estático
 * @param {HTMLImageElement} imgElement 
 */
async function runStaticPrediction(imgElement) {
    if (model == null) 
        await loadModel();
     
    const prediction = await model.predict(imgElement);
    predictClass(prediction);
}