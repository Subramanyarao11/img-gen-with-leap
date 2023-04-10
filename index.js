import axios from "axios";
import { Leap } from "@leap-ai/sdk";

const leap = new Leap(process.env['API_KEY'])
// const mySecret = process.env['API_KEY']

// Fine-tune a model with Donald Trump Image Samples. 
// For fine-tuning tips see https://guides.tryleap.ai/guides/faqs-avatar-fine-tuning 
const trainingImages = [
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22f9bfcb437d92c763d5_logo3-20.png",
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22f9d1241ec66bbc3365_logo-3.png",
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22f932252b1eecd7577e_logo.png",
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22f9fae847b2f8e0058e_logo-2.png",
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22f966c5ec88bc3a4ecf_logo-1.png",
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22fa8a354519eef8a270_logo-5.png",
  "https://uploads-ssl.webflow.com/631e7debd95a0a0b974074e2/642f22fa68e5401fe107112f_logo-4.png"
]

// Set the image prompt. Notice how I'm using '@me' subjectKeyword to get pictures similar to the ones we upload to fine tune our model
const prompt = "a psychedelic portrait of @me, vibrant color scheme, highly detailed, in the style of romanticism, cinematic, artstation, moebius, greg rutkowski"

// Flag to check if you have existing models trained. Setting useExistingModel to false will train a new model on each Repl run
const useExistingModel = true

let modelId = null;
let versionId = null;
let trainingStatus = null
let subjectKeyword = "@me"

if (useExistingModel) {
  console.log("Checking for existing models")
  // List all models
  const { data: modelList, error: modelListError } = await leap.fineTune.listModels();
  if (modelListError) {
    console.log("To generate AI Photos, please fork the code, get an API Key from https://www.tryleap.ai, and open README.md for setup instructions.")
    process.exit()
  }
  // Check for existing models, use first model created
  const existingModel = modelList[0]
  modelId = existingModel ? existingModel.id : null
  subjectKeyword = existingModel ? existingModel.subjectKeyword : "@me"

  console.log("Found Model: ", existingModel ? existingModel : null)
  // If exists, get versionId and training status
  if (modelId) {
    console.log("Checking for existing versions")
    const { data: listModelVersions, error: listModelVersionsError } = await leap.fineTune.listModelVersions({
      modelId: modelId,
    });
    // Check for existing versions, use first version created
    const existingVersion = listModelVersions[0]
    versionId = existingVersion ? existingVersion.id : null
    trainingStatus = existingVersion ? existingVersion.status : null
    console.log("Found Version: ", existingVersion)
  }
}

// If no existing model, create a custom model so we can fine tune it.
if (modelId === null) {
  console.log("Creating New Model...")
  const { data: model, error: modelError } = await leap.fineTune.createModel({
    title: "AI Image generation",
    subjectKeyword: "@me",
  });

  modelId = model.id;
  subjectKeyword = model.subjectKeyword
  console.log("New Model Created: ", model)
  // We now upload the images to fine tune this model.
  const { data: imageSample, error: imageSampleError } = await leap.fineTune.uploadImageSamples({
    modelId: modelId,
    images: trainingImages,
  });
  console.log("Image Samples Uploaded: ", imageSample)
}

// If no existing version, train new version
if (versionId == null) {
  // Now it's time to fine tune the model. 
  const { data: newVersion, error: newVersionError } = await leap.fineTune.queueTrainingJob({
    modelId: modelId
  });
  // Check if hit paid API limit or missing samples
  if (newVersionError) {
    console.log("Error: ", newVersionError.message)
    process.exit()
  }
  versionId = newVersion.id;
  trainingStatus = newVersion.status

  console.log("New Training Version: ", newVersion)
  console.log("Training Status: ", trainingStatus)
}

// Notice how I'm continuously getting the status of the training job and waiting until it's finished before moving on.
while (trainingStatus != "finished") {
  const { data: checkStatus, error: checkStatusError } = await leap.fineTune.getModelVersion({
    modelId: modelId,
    versionId: versionId,
  });
  const status = checkStatus.status
  console.log("Status: ", status)

  trainingStatus = status;
  // wait for 10 seconds before re-polling status
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
console.log("Training Status: " + trainingStatus)

// Now that we have a fine-tuned version of a model, we can generate images using it. Make sure subjectKeyword, ie. '@me' is in prompt
if (!prompt.includes(subjectKeyword)) {
  console.log("Error: missing subjectKeyword " + subjectKeyword + " in prompt. Please add it and re-run.")
  process.exit()
}

console.log("Image prompt: " + prompt)
console.log("Generating image...\nThis will take around 10 seconds\n")
const { data: image, error: imageError } = await leap.generate.generateImage({
  prompt: prompt,
  modelId: modelId,
  numberOfImages: 4,
});

image.images.forEach((image) => {
  console.log("Image ready: ", image.uri);
});