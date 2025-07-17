const labelText = document.getElementById("pageUrl")

const normalREF = document.getElementById("normal-btn")
const advancedlREF = document.getElementById("advanced-btn")
const stopRef = document.getElementById("stop-btn")

function handeClick() {
    if (labelText === null || labelText.value.trim() === "") {
        alert("You need to put an url to start!!")
    } else {
        console.log(labelText.value.trim())
    }
}


advancedlREF.addEventListener('click', handeClick);

    


