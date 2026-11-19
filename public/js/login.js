const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const button = document.getElementById("loginButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.className = "message";
    message.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    button.disabled = true;
    button.textContent = "Logging in...";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Login failed.");
        }

        message.textContent = result.message;
        message.className = "message success";

        setTimeout(() => {
            window.location.href = result.redirect || "/dashboard";
        }, 700);

    } catch (error) {
        message.textContent = error.message;
        message.className = "message error";

        button.disabled = false;
        button.textContent = "Log In";
    }
});
