const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const button = document.getElementById("registerButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.className = "message";
    message.textContent = "";

    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        message.textContent = "Your passwords do not match.";
        message.className = "message error";
        return;
    }

    button.disabled = true;
    button.textContent = "Creating your account...";

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fullName,
                email,
                password,
                confirmPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Registration failed.");
        }

        message.textContent = result.message;
        message.className = "message success";

        setTimeout(() => {
            window.location.href = result.redirect;
        }, 1200);

    } catch (error) {
        message.textContent = error.message;
        message.className = "message error";

        button.disabled = false;
        button.textContent = "Create My Account";
    }
});
