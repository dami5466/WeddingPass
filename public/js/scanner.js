const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const manualForm = document.getElementById("manualForm");
const manualToken = document.getElementById("manualToken");

const resultCard = document.getElementById("result");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const guestDetails = document.getElementById("guestDetails");
const nextButton = document.getElementById("nextButton");

let scanner = null;
let scannerRunning = false;
let processing = false;

function extractToken(value) {
    const input = String(value || "").trim();

    try {
        const url = new URL(input);
        const parts = url.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
    } catch {
        return input;
    }
}

function showResult(type, title, message, guest = null) {
    resultCard.classList.remove("hidden", "valid", "invalid", "used");
    resultCard.classList.add(type);

    resultIcon.textContent =
        type === "valid" ? "✓" :
        type === "used" ? "!" : "✕";

    resultTitle.textContent = title;
    resultMessage.textContent = message;
    guestDetails.innerHTML = "";

    if (guest) {
        const details = [
            ["Guest", guest.name],
            ["Category", guest.category],
            ["Wedding", guest.wedding],
            ["Check-in time", guest.checkedInAt]
        ];

        details.forEach(([label, value]) => {
            if (!value) return;

            const row = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = label + ": ";
            row.append(strong, document.createTextNode(value));
            guestDetails.appendChild(row);
        });
    }
}

async function verifyInvitation(value) {
    if (processing) return;

    const token = extractToken(value);

    if (!token) {
        showResult("invalid", "INVALID INVITATION", "No valid invitation token was found.");
        return;
    }

    processing = true;

    try {
        const response = await fetch("/api/check-in", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (data.status === "VALID") {
            showResult(
                "valid",
                "ACCESS GRANTED",
                data.message,
                data.guest
            );
        } else if (data.status === "ALREADY USED") {
            showResult(
                "used",
                "ALREADY USED",
                data.message,
                data.guest
            );
        } else {
            showResult(
                "invalid",
                "ACCESS DENIED",
                data.message || "This invitation is invalid."
            );
        }

    } catch (error) {
        showResult(
            "invalid",
            "VERIFICATION ERROR",
            "Could not contact WeddingPass. Check your connection."
        );
    } finally {
        processing = false;
    }
}

async function startScanner() {
    if (!window.Html5Qrcode) {
        alert("The scanner library could not load. Check your internet connection.");
        return;
    }

    if (!scanner) {
        scanner = new Html5Qrcode("reader");
    }

    try {
        await scanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 230, height: 230 }
            },
            async (decodedText) => {
                if (processing) return;

                await stopScanner();
                await verifyInvitation(decodedText);
            },
            () => {}
        );

        scannerRunning = true;
        startButton.disabled = true;
        stopButton.disabled = false;

    } catch (error) {
        alert("Camera could not start. Allow camera permission and try again.");
    }
}

async function stopScanner() {
    if (scanner && scannerRunning) {
        try {
            await scanner.stop();
        } catch (error) {
            console.error(error);
        }

        scannerRunning = false;
    }

    startButton.disabled = false;
    stopButton.disabled = true;
}

const checkInPath = window.location.pathname.match(/^\/check-in\/([^/]+)\/?$/);

if (checkInPath) {
    manualToken.value = decodeURIComponent(checkInPath[1]);
    manualToken.focus();
}
startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);

manualForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!manualToken.value.trim()) {
        alert("Enter a QR invitation URL or token.");
        return;
    }

    await stopScanner();
    await verifyInvitation(manualToken.value);
    manualToken.value = "";
});

nextButton.addEventListener("click", async () => {
    resultCard.classList.add("hidden");
    guestDetails.innerHTML = "";
    await startScanner();
});

