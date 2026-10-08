/* =========================================================
   ARM WRESTLING SIMULATOR
   Pure JavaScript
========================================================= */


const needle = document.getElementById("needle");
const target = document.getElementById("target");
const perfect = document.getElementById("perfect");

const result = document.getElementById("result");

const comboDisplay = document.getElementById("combo");
const reactionDisplay = document.getElementById("reaction");
const difficultyDisplay = document.getElementById("difficulty");

const enemyPowerBar = document.getElementById("enemyPower");
const playerPowerBar = document.getElementById("playerPower");

const enemyPowerText = document.getElementById("enemyPowerText");
const playerPowerText = document.getElementById("playerPowerText");

const accuracyDisplay = document.getElementById("accuracy");
const bestComboDisplay = document.getElementById("bestCombo");
const winsDisplay = document.getElementById("wins");

const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");

const wheel = document.getElementById("wheel");


/* =========================================================
   GAME STATE
========================================================= */

let running = false;

let animationFrame = null;

let angle = 0;

let lastTime = 0;

let targetCenter = 0;

let targetSize = 45;

let perfectSize = 10;

let combo = 0;

let bestCombo = 0;

let playerPower = 100;

let enemyPower = 100;

let difficulty = 1;

let totalHits = 0;

let totalAttempts = 0;

let wins = 0;

let roundStartTime = 0;


/* =========================================================
   NEEDLE SPEED
========================================================= */

function getNeedleSpeed() {

    /*
        degrees / second

        Difficulty increases the speed.
    */

    return 150 + (difficulty - 1) * 15;
}


/* =========================================================
   RANDOM TARGET
========================================================= */

function generateTarget() {

    /*
        Keep target away from the extreme edges
        to make the game more playable.
    */

    targetCenter =
        Math.random() * 300 + 30;

    /*
        Difficulty makes the target smaller.
    */

    targetSize =
        Math.max(
            22,
            48 - difficulty * 2
        );

    perfectSize =
        Math.max(
            5,
            targetSize * 0.22
        );

    updateTargetVisual();
}


/* =========================================================
   TARGET VISUAL
========================================================= */

function updateTargetVisual() {

    /*
        CSS conic-gradient starts at 12 o'clock.

        Target = yellow zone
        Perfect = green zone
    */

    const targetStart = targetCenter - targetSize / 2;

    const targetEnd = targetCenter + targetSize / 2;

    const perfectStart =
        targetCenter - perfectSize / 2;

    const perfectEnd =
        targetCenter + perfectSize / 2;


    target.style.background = `
        conic-gradient(
            from 0deg,
            transparent 0deg ${targetStart}deg,
            rgba(230, 200, 79, 0.75)
            ${targetStart}deg ${targetEnd}deg,
            transparent ${targetEnd}deg 360deg
        )
    `;


    perfect.style.background = `
        conic-gradient(
            from 0deg,
            transparent 0deg ${perfectStart}deg,
            rgba(72, 209, 124, 0.95)
            ${perfectStart}deg ${perfectEnd}deg,
            transparent ${perfectEnd}deg 360deg
        )
    `;
}


/* =========================================================
   NORMALIZE ANGLE
========================================================= */

function normalizeAngle(value) {

    value %= 360;

    if (value < 0) {
        value += 360;
    }

    return value;
}


/* =========================================================
   ANGLE DIFFERENCE
========================================================= */

function angleDifference(a, b) {

    let difference =
        Math.abs(
            normalizeAngle(a) -
            normalizeAngle(b)
        );

    if (difference > 180) {
        difference = 360 - difference;
    }

    return difference;
}


/* =========================================================
   CHECK HIT
========================================================= */

function checkHit() {

    if (!running) {
        return;
    }

    const now = performance.now();

    const currentAngle =
        normalizeAngle(angle);

    const difference =
        angleDifference(
            currentAngle,
            targetCenter
        );


    totalAttempts++;


    /*
        PERFECT
    */

    if (difference <= perfectSize / 2) {

        perfectHit();

    }


    /*
        GOOD
    */

    else if (difference <= targetSize / 2) {

        goodHit();

    }


    /*
        MISS
    */

    else {

        missHit();

    }


    totalHits++;

    updateAccuracy();

    updateUI();
}


/* =========================================================
   PERFECT HIT
========================================================= */

function perfectHit() {

    combo++;

    bestCombo =
        Math.max(
            bestCombo,
            combo
        );

    /*
        Perfect gives a large advantage.
    */

    enemyPower -=
        7 + difficulty * 0.5;

    /*
        Small player recovery.
    */

    playerPower =
        Math.min(
            100,
            playerPower + 1.5
        );

    const reaction =
        performance.now() -
        roundStartTime;

    reactionDisplay.textContent =
        `${Math.round(reaction)} ms`;

    result.textContent = "PERFECT";

    result.className =
        "result perfect";

    difficulty =
        Math.min(
            15,
            1 + Math.floor(combo / 4)
        );

    generateTarget();
}


/* =========================================================
   GOOD HIT
========================================================= */

function goodHit() {

    combo++;

    bestCombo =
        Math.max(
            bestCombo,
            combo
        );

    enemyPower -=
        3.5 + difficulty * 0.25;

    const reaction =
        performance.now() -
        roundStartTime;

    reactionDisplay.textContent =
        `${Math.round(reaction)} ms`;

    result.textContent = "GOOD";

    result.className =
        "result good";

    difficulty =
        Math.min(
            15,
            1 + Math.floor(combo / 4)
        );

    generateTarget();
}


/* =========================================================
   MISS
========================================================= */

function missHit() {

    combo = 0;

    /*
        Player loses power.

        Difficulty determines how punishing
        the miss is.
    */

    playerPower -=
        5 + difficulty * 0.5;

    result.textContent = "MISS";

    result.className =
        "result miss";

    /*
        Reset difficulty partially.
    */

    difficulty =
        Math.max(
            1,
            difficulty - 1
        );

    generateTarget();
}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(timestamp) {

    if (!running) {
        return;
    }

    if (!lastTime) {
        lastTime = timestamp;
    }

    const delta =
        (timestamp - lastTime) / 1000;

    lastTime = timestamp;


    angle +=
        getNeedleSpeed() * delta;

    angle =
        normalizeAngle(angle);


    needle.style.transform =
        `rotate(${angle}deg)`;


    /*
        Check win/loss
    */

    if (enemyPower <= 0) {

        enemyPower = 0;

        endGame(true);

        return;
    }


    if (playerPower <= 0) {

        playerPower = 0;

        endGame(false);

        return;
    }


    updateUI();


    animationFrame =
        requestAnimationFrame(gameLoop);
}


/* =========================================================
   START
========================================================= */

function startGame() {

    if (running) {
        return;
    }

    running = true;

    combo = 0;

    playerPower = 100;

    enemyPower = 100;

    difficulty = 1;

    angle = 0;

    totalHits = 0;

    totalAttempts = 0;

    lastTime = 0;

    reactionDisplay.textContent =
        "-- ms";

    result.textContent =
        "FIGHT";

    result.className =
        "result";

    startButton.textContent =
        "MATCH IN PROGRESS";

    startButton.disabled = true;

    generateTarget();

    roundStartTime =
        performance.now();

    animationFrame =
        requestAnimationFrame(gameLoop);

    updateUI();
}


/* =========================================================
   END GAME
========================================================= */

function endGame(playerWon) {

    running = false;

    cancelAnimationFrame(
        animationFrame
    );

    startButton.disabled = false;

    startButton.textContent =
        "START MATCH";


    if (playerWon) {

        wins++;

        result.textContent =
            "YOU WIN";

        result.className =
            "result perfect";

    } else {

        result.textContent =
            "DEFEATED";

        result.className =
            "result miss";
    }


    saveStats();

    updateUI();
}


/* =========================================================
   RESET
========================================================= */

function resetGame() {

    running = false;

    cancelAnimationFrame(
        animationFrame
    );

    combo = 0;

    bestCombo = 0;

    playerPower = 100;

    enemyPower = 100;

    difficulty = 1;

    angle = 0;

    totalHits = 0;

    totalAttempts = 0;

    wins = 0;

    result.textContent =
        "PRESS SPACE";

    result.className =
        "result";

    startButton.disabled = false;

    startButton.textContent =
        "START MATCH";

    reactionDisplay.textContent =
        "-- ms";

    generateTarget();

    updateUI();

    localStorage.removeItem(
        "armWrestlingStats"
    );
}


/* =========================================================
   UI
========================================================= */

function updateUI() {

    comboDisplay.textContent =
        combo;

    bestComboDisplay.textContent =
        bestCombo;

    winsDisplay.textContent =
        wins;

    difficultyDisplay.textContent =
        difficulty;


    enemyPowerBar.style.width =
        `${Math.max(0, enemyPower)}%`;

    playerPowerBar.style.width =
        `${Math.max(0, playerPower)}%`;


    enemyPowerText.textContent =
        Math.round(enemyPower);

    playerPowerText.textContent =
        Math.round(playerPower);


    updateAccuracy();
}


/* =========================================================
   ACCURACY
========================================================= */

function updateAccuracy() {

    if (totalAttempts === 0) {

        accuracyDisplay.textContent =
            "100%";

        return;
    }

    const accuracy =
        totalHits /
        totalAttempts *
        100;

    accuracyDisplay.textContent =
        `${Math.round(accuracy)}%`;
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function saveStats() {

    const stats = {

        bestCombo,

        wins

    };

    localStorage.setItem(
        "armWrestlingStats",
        JSON.stringify(stats)
    );
}


function loadStats() {

    const stored =
        localStorage.getItem(
            "armWrestlingStats"
        );

    if (!stored) {
        return;
    }

    try {

        const stats =
            JSON.parse(stored);

        bestCombo =
            stats.bestCombo || 0;

        wins =
            stats.wins || 0;

    } catch (error) {

        console.warn(
            "Unable to load saved stats."
        );
    }
}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.code === "Space"
        ) {

            event.preventDefault();

            if (!running) {

                startGame();

            } else {

                checkHit();

            }
        }

    }
);


/* =========================================================
   MOUSE / TOUCH
========================================================= */

wheel.addEventListener(
    "mousedown",
    function() {

        if (!running) {

            startGame();

        } else {

            checkHit();

        }

    }
);


wheel.addEventListener(
    "touchstart",
    function(event) {

        event.preventDefault();

        if (!running) {

            startGame();

        } else {

            checkHit();

        }

    },
    {
        passive: false
    }
);


/* =========================================================
   BUTTONS
========================================================= */

startButton.addEventListener(
    "click",
    startGame
);


resetButton.addEventListener(
    "click",
    resetGame
);


/* =========================================================
   INIT
========================================================= */

loadStats();

generateTarget();

updateUI();

needle.style.transform =
    "rotate(0deg)";
