const labelText = document.getElementById("pageUrl");
const timeSelected = document.getElementById("refresh-timer");

const normalREF = document.getElementById("normal-btn");
const advancedlREF = document.getElementById("advanced-btn");
const stopRef = document.getElementById("stop-btn");

let countdown;

function handeClick() {
    const url = labelText.value.trim();
    const timeInSeconds = parseInt(timeSelected.value);

    if (!url) {
        alert("You need to put a URL to start!!");
        return;
    }

    const timeInMs = timeInSeconds * 1000;

    alert("Auto-refresh started! The page will reload in " + (timeInSeconds / 60) + " minutes.");

    // ✅ Countdown in console
    let remainingTime = timeInSeconds;
    
    countdown = setInterval(() => {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        const formatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        console.log("Refreshing in: " + formatted);
        remainingTime--;
        if (remainingTime < 0) clearInterval(countdown);
    }, 1000);

    // ✅ Refresh after selected time
    setTimeout(function () {
        window.location.href = url;
    }, timeInMs);
}


// Use only JavaScript to handle the button
normalREF.addEventListener('click', handeClick);


stopRef.addEventListener('dblclick', function () {
    clearInterval(countdown);
    labelText.value = "";
    console.log("Refreshing page is off");
});
