**Skill Name:** IT Support Simulation Skill  

# IT Support Simulation Skill  

## 1. Description  
This skill creates a realistic, interactive IT support simulation that can be used for training new help‑desk agents, onboarding staff, or testing troubleshooting procedures. The simulation presents users with typical end‑user issues (e.g., connectivity problems, software errors, hardware failures) and guides them through the diagnostic and resolution steps. The skill can be invoked from the AIHub chat interface, and it runs entirely within the conversation, adapting to user responses and providing feedback on the correctness of each action.

## 2. When to Use It  

| Scenario | Why Use This Skill |
|----------|-------------------|
| **New hire onboarding** | Gives fresh agents hands‑on practice without affecting real users or systems. |
| **Skill refresher** | Lets experienced staff rehearse rare or complex issues quickly. |
| **Assessment & certification** | Provides a measurable, scenario‑based test for competency evaluation. |
| **Process documentation** | Generates a step‑by‑step transcript that can be turned into SOPs. |
| **Customer‑service workshops** | Enables role‑playing between trainees and trainers. |

## 3. Step‑by‑Step Instructions  

1. **Activate the skill**  
   ```text
   /run it-support-simulation
   ```  

2. **Select a scenario** (the skill offers a menu).  
   - Example options:  
     1. Wi‑Fi connectivity loss  
     2. Printer “offline” error  
     3. Application crash on launch  
     4. Password reset with MFA issues  
     5. Virus quarantine removal  

3. **Read the user ticket**  
   The skill displays the simulated ticket details (user name, department, description, urgency).  

4. **Gather information**  
   - Ask the user (simulated) for relevant data (OS version, recent changes, error codes).  
   - The skill will respond with realistic answers or clues.  

5. **Diagnose**  
   - Choose a diagnostic command or tool (e.g., `ping`, `ipconfig`, `eventvwr`).  
   - The skill returns mock output.  

6. **Propose a solution**  
   - Provide a step‑by‑step fix (e.g., restart service, reinstall driver).  
   - The skill will confirm whether the solution resolves the issue.  

7. **Document the ticket**  
   - The skill prompts for a brief resolution note.  
   - It then generates a formatted ticket entry.  

8. **Feedback & Scoring**  
   - After completion, the skill gives a score (0‑100) based on: correct diagnostics, efficient steps, and proper documentation.  
   - Optional: request a debrief or repeat with a different scenario.  

## 4. Code Examples  

### 4.1. Sample Interaction (CLI style)

```
User: /run it-support-simulation
AI: Welcome to the IT Support Simulation! Choose a scenario:
1️⃣ Wi‑Fi connectivity loss
2️⃣ Printer offline
3️⃣ Application crash
4️⃣ Password reset issue
5️⃣ Virus quarantine
Enter the number of your choice:
> 1

AI: **Ticket #4521 – Jane Doe – Marketing**
Subject: "Can't connect to corporate Wi‑Fi since this morning."
Urgency: High
Description: "My laptop shows 'Limited connectivity' and I cannot access SharePoint."

AI: What is the OS and Wi‑Fi adapter model?
> Windows 10, Intel Dual Band Wireless‑AC 8265

AI: Running `netsh wlan show interfaces`...
```

### 4.2. Embedding the Skill in a Bot (Node.js)

```javascript
const { createSkill } = require('aihub-sdk');

const itSupportSimulation = createSkill({
  name: 'it-support-simulation',
  description: 'Interactive IT support scenario trainer',
  run: async (context) => {
    const scenario = await context.select('Choose a scenario', [
      'Wi‑Fi connectivity loss',
      'Printer offline',
      'Application crash',
      'Password reset issue',
      'Virus quarantine',
    ]);
    // Load scenario data from JSON files
    const ticket = await loadTicket(scenario);
    await context.sendMessage(formatTicket(ticket));

    // Loop: ask, diagnose, resolve
    while (!context.state.resolved) {
      const userInput = await context.ask('Your next action?');
      const result = await processAction(userInput, context.state);
      await context.sendMessage(result);
    }

    const score = evaluatePerformance(context.history);
    await context.sendMessage(`✅ Issue resolved. Your score: ${score}/100`);
  },
});

module.exports = itSupportSimulation;
```

### 4.3. Scenario JSON Template  

```json
{
  "id": "wifi-01",
  "title": "Wi‑Fi connectivity loss",
  "ticket": {
    "user": "Jane Doe",
    "department": "Marketing",
    "urgency": "High",
    "description": "My laptop shows 'Limited connectivity' and I cannot access SharePoint."
  },
  "environment": {
    "os": "Windows 10",
    "adapter": "Intel Dual Band Wireless‑AC 8265",
    "ipConfig": "169.254.x.x"
  },
  "expectedSteps": [
    "run netsh wlan show interfaces",
    "verify DHCP lease",
    "restart WLAN AutoConfig service",
    "re‑connect to SSID"
  ],
  "resolutionNote": "Reset WLAN service and renewed DHCP lease; connectivity restored."
}
```

## 5. Best Practices  

| Practice | Reason |
|----------|--------|
| **Start with low‑complexity scenarios** for beginners, then progress to multi‑step issues. |
| **Encourage proper questioning** – always ask for OS version, recent changes, and error codes before jumping to fixes. |
| **Document every action** inside the simulation; the final ticket note should be concise but complete. |
| **Use the scoring feedback** to identify knowledge gaps and schedule targeted micro‑learning. |
| **Keep scenario data external (JSON/YAML)** so new tickets can be added without code changes. |
| **Reset the state** after each run to avoid cross‑scenario contamination. |
| **Leverage AIHub’s built‑in timers** to simulate realistic response times (e.g., waiting 2 seconds after a command). |

## 6. Common Pitfalls to Avoid  

| Pitfall | How to Prevent |
|---------|----------------|
| **Skipping information gathering** – jumping straight to a fix. | Enforce a mandatory “Ask for details” step in the skill flow. |
| **Hard‑coding OS‑specific commands**; the simulation fails on other platforms. | Provide separate command sets per OS and detect the simulated environment. |
| **Over‑complicating output** – users receive raw logs they cannot read. | Summarize command output and highlight key lines (e.g., “IP address: 169.254.x.x”). |
| **Not resetting state** – previous scenario data leaks into the next run. | Call `context.reset()` at the end of each session. |
| **Ignoring ticket closure** – simulation ends without a proper resolution note. | Add a final validation step that requires the user to submit a note before scoring. |
| **Using real credentials or network names** in scenario files. | Use fictional company names and dummy IP ranges (e.g., 10.0.0.0/24). |
| **Forgetting to update the scenario library**; outdated tech becomes irrelevant. | Schedule quarterly reviews to refresh hardware models and OS versions. |

---  

**Ready to deploy?**  
Add the `it-support-simulation` folder (containing `skill.js`, `scenarios/`, and `README.md`) to your AIHub skills directory, run `aihub deploy`, and start training your support team today!