window.BLOODLINE_APPLICATION_FORMS = [
  {
    key: "moderator-app",
    title: "Moderator Application",
    type: "server",
    description: "Apply to help moderate the Bloodline RP Discord community.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "age", label: "How old are you IRL", kind: "text", required: true },
      { id: "timezone", label: "What time zone are you in?", kind: "text", required: true },
      { id: "modExperience", label: "Have you ever been a moderator in any type of discord server? If yes what type of community and where?", kind: "textarea", required: true },
      { id: "whyModerator", label: "Why do you want to be a moderator for Bloodline RP?", kind: "textarea", required: true },
      { id: "whyChoose", label: "Why should we chose you out of everybody to be a moderator of the Bloodline RP discord server?", kind: "textarea", required: true },
      { id: "fairRules", label: "Do you understand that you will not be able to show any favoritism towards family or friends and you must enforce rules the same with everybody?", kind: "yesno", required: true },
      { id: "discordActivity", label: "How active are you able to be within the discord?", kind: "textarea", required: true },
      { id: "scenario1", label: "Scenario Question 1: There are 2 individuals having an argument in general chat and it starts to get heated. How would you proceed?", kind: "textarea", required: true },
      { id: "scenario2", label: "Scenario Question 2: Someone is in general chat and asking for help in city on how to get out of their apartment, open his inventory, etc. How do you proceed?", kind: "textarea", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee you a spot on our moderator team?", kind: "yesno", required: true }
    ]
  },
  {
    key: "staff-app",
    title: "Staff Application",
    type: "server",
    description: "Apply to join the Bloodline RP in-city staff team.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "age", label: "How old are you IRL?", kind: "text", required: true },
      { id: "timezone", label: "What time zone are you in?", kind: "text", required: true },
      { id: "staffExperience", label: "Have you ever been staff of a FiveM server before? If yes what server(s)?", kind: "textarea", required: true },
      { id: "whyStaff", label: "Why do you want to be staff for Bloodline RP?", kind: "textarea", required: true },
      { id: "whyChoose", label: "Why should we chose you out of everybody to join our staff team of Bloodline RP?", kind: "textarea", required: true },
      { id: "fairEnforcement", label: "Do you understand that you must enforce all the rules the same regardless of who rule breaks?", kind: "yesno", required: true },
      { id: "cityActivity", label: "How active are you able to be in city?", kind: "textarea", required: true },
      { id: "scenario1", label: "Scenario Question 1: You see someone running around and robbing people one after another with no RP reason behind it. He's doing it for his own financial gain. How do you proceed?", kind: "textarea", required: true },
      { id: "scenario2", label: "Scenario Question 2: You see somebody that has been camping the house robbery guy for 5 minutes and he continues to sit there waiting to get a job. How do you proceed?", kind: "textarea", required: true },
      { id: "scenario3", label: "Scenario Question 3: You're sitting at Alta with a group of people and someone comes speeding through and clearly aims for the group of people running everybody over. How do you proceed?", kind: "textarea", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee you a spot on our staff team?", kind: "yesno", required: true }
    ]
  },
  {
    key: "developer-app",
    title: "Developer Application",
    type: "server",
    description: "Apply for the Bloodline RP development team.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "age", label: "How old are you IRL?", kind: "text", required: true },
      { id: "whyDev", label: "Why do you want to be part of the dev team for Bloodline RP?", kind: "textarea", required: true },
      { id: "devExperience", label: "What is your developing experience? Please be specific here.", kind: "textarea", required: true },
      { id: "fivemExperience", label: "Have you ever been apart of a FiveM dev team? If yes what server and what was your role?", kind: "textarea", required: true },
      { id: "portfolio", label: "Do you have a portfolio of your previous work? if yes please provide a link.", kind: "text", required: true },
      { id: "devArea", label: "What part of the dev team are you interested in? (vehicles, clothing, mapping, scripting, modeling)", kind: "textarea", required: true },
      { id: "voluntary", label: "Do you understand that this position is voluntary until the server is in a position to be able to pay their developers?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee you a spot on our dev team?", kind: "yesno", required: true }
    ]
  },
  {
    key: "allowlist-app",
    title: "Allowlist Application",
    type: "server",
    description: "Apply for allowlist to gain access to the city.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "age", label: "How old are you IRL?", kind: "text", required: true },
      { id: "rpDuration", label: "How long have you been roleplaying for?", kind: "textarea", required: true },
      { id: "otherServers", label: "Have you ever played in any other servers? List some if you have.", kind: "textarea", required: true },
      { id: "characterName", label: "What is your characters name?", kind: "text", required: true },
      { id: "backstory", label: "What is your characters backstory?", kind: "textarea", required: true },
      { id: "strengths", label: "What is your characters strengths?", kind: "textarea", required: true },
      { id: "weaknesses", label: "What is your characters weaknesses?", kind: "textarea", required: true },
      { id: "scenario1", label: "Scenario Question 1: You are walking down the street minding your own business when 3 masked men come up to you with guns and tell you to put yours hands up. How does your character react and handle the situation?", kind: "textarea", required: true },
      { id: "scenario2", label: "Scenario Question 2: You get pulled over for speeding, the officer walks up to your window and asks for your license then tells you to step out of the car. How does your character react and handle the traffic stop?", kind: "textarea", required: true },
      { id: "scenario3", label: "Scenario Question 3: You had just got gunned down in a drive by shooting and when EMS arrives they check your injuries with /me's. How would you respond and which /me's would you do?", kind: "textarea", required: true },
      { id: "metagaming", label: "What does metagaming mean to you?", kind: "textarea", required: true },
      { id: "powergaming", label: "What does powergaming mean to you?", kind: "textarea", required: true },
      { id: "rdm", label: "What is RDM? Give at least 1 example.", kind: "textarea", required: true },
      { id: "vdm", label: "What is VDM? Give at least 1 example.", kind: "textarea", required: true }
    ]
  },
  {
    key: "ban-appeal-app",
    title: "Ban Appeal",
    type: "server",
    description: "Submit an appeal for a server ban.",
    questions: [
      { id: "discordName", label: "what is your discord name?", kind: "text", required: true },
      { id: "banDate", label: "when were you banned?", kind: "text", required: true },
      { id: "banReason", label: "what was the reason for your ban?", kind: "textarea", required: true },
      { id: "banDuration", label: "what is the duration of your ban?", kind: "text", required: true },
      { id: "unbanReason", label: "why do you feel like you should be unbanned?", kind: "textarea", required: true }
    ]
  },
  {
    key: "leo-app",
    title: "LEO Application",
    type: "public-safety",
    description: "Apply for the Los Santos Police Department.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "icName", label: "First and last name (IC)", kind: "text", required: true },
      { id: "phone", label: "In city phone number (if applicable)", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what are the crimes?", kind: "textarea", required: true },
      { id: "whyJoin", label: "Why would you like to join the Los Santos Police Department?", kind: "textarea", required: true },
      { id: "experience", label: "Do you have any experience as part of law enforcement team? If yes, what was your rank?", kind: "textarea", required: true },
      { id: "codes", label: "We use 10-codes and other means to communicate. are you able to retain information and learn quickly?", kind: "yesno", required: true },
      { id: "bringValue", label: "What can you bring to the Los Santos Police Department that would change things for the better?", kind: "textarea", required: true },
      { id: "scenario1", label: "Scenario Question 1: A Suspect fires at you with an Automatic Weapon and then takes cover. When the suspect leaves cover he has no weapon out, his back it to you, and he is fleeing. What do you do? Use as much details as possible here.", kind: "textarea", required: true },
      { id: "scenario2", label: "Scenario 2: You pull over a vehicle going 15 MPH over the speed limit. When you approach the vehicle you ask for the individuals drivers license and he responds that he will not be providing you with it. What is your next step? Use as much details as possible here", kind: "textarea", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance into the police force?", kind: "yesno", required: true }
    ]
  },
  {
    key: "ems-app",
    title: "EMS Application",
    type: "public-safety",
    description: "Apply for emergency medical services.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "icName", label: "First and last name (IC)", kind: "text", required: true },
      { id: "phone", label: "In city phone number (if applicable)", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what are the crimes?", kind: "textarea", required: true },
      { id: "whyEms", label: "Why do you want to be EMS?", kind: "textarea", required: true },
      { id: "whyChoose", label: "Why should we chose you to be EMS over all our other candidates?", kind: "textarea", required: true },
      { id: "stayClean", label: "Do u understand being hired on as EMS you must stay clean and do no crime of any kind?", kind: "yesno", required: true },
      { id: "scenario1", label: "Scenario Question 1: You come across someone laying on the ground and they are unresponsive. You have no idea what happened to them and they are not talking. How would you proceed? What /me's would you use? Use as much details as possible here.", kind: "textarea", required: true },
      { id: "scenario2", label: "Scenario Question 2: You respond to a shoot out between officers and a gang. When you arrive on scene there are 3 downed gang members and 2 downed officers. Who would you treat first and how would you approach? What /me's would you use? Use as much details as possible here.", kind: "textarea", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance to be EMS?", kind: "yesno", required: true }
    ]
  },
  {
    key: "fire-app",
    title: "Fire Application",
    type: "public-safety",
    description: "Apply for the fire department.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "icName", label: "First and last name (IC)", kind: "text", required: true },
      { id: "phone", label: "In city phone number (if applicable)", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what are the crimes?", kind: "textarea", required: true },
      { id: "whyFire", label: "Why do you want to fight fires?", kind: "textarea", required: true },
      { id: "whyChoose", label: "Why should we chose you over every other candidate?", kind: "textarea", required: true },
      { id: "stayClean", label: "Do u understand being hired on to our Fire Department you must stay clean and do no crime of any kind?", kind: "yesno", required: true },
      { id: "scenario1", label: "Scenario Question 1: You get a call for a business that is on fire. Upon arriving on the scene you see the building up in flames and muffled screams coming from inside. How do you approach the situation? What is your first course of action? Go into as much detail as possible here.", kind: "textarea", required: true },
      { id: "scenario2", label: "Scenario Question 2: You get a call from a woman that claims her cat is stuck in a tree. Upon arriving the woman is crying and her cat is meowing at the top of the tree. How would you approach the situation?", kind: "textarea", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance to be part of our Fire Department?", kind: "yesno", required: true }
    ]
  },
  {
    key: "mayor-app",
    title: "Mayor Application",
    type: "city-hall",
    description: "Apply to run for city mayor.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "timezone", label: "What time zone are you in?", kind: "text", required: true },
      { id: "age", label: "How old are you? (IRL)", kind: "text", required: true },
      { id: "icName", label: "What is your name? (IC)", kind: "text", required: true },
      { id: "phone", label: "What is your in city phone number?", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what were the charges?", kind: "textarea", required: false },
      { id: "whyMayor", label: "Why do you want to be mayor of the lovely city of Los Santos?", kind: "textarea", required: true },
      { id: "qualified", label: "What makes you qualified to be our new mayor?", kind: "textarea", required: true },
      { id: "threeChanges", label: "What are 3 things you would change to make the city better?", kind: "textarea", required: true },
      { id: "noCrime", label: "Do you understand that while you hold office you are not allowed to participate in crime of any kind?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance to be our new mayor?", kind: "yesno", required: true }
    ]
  },
  {
    key: "city-council-app",
    title: "City Council Application",
    type: "city-hall",
    description: "Apply to join city council.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "timezone", label: "What time zone are you in?", kind: "text", required: true },
      { id: "age", label: "How old are you? (IRL)", kind: "text", required: true },
      { id: "icName", label: "What is your name? (IC)", kind: "text", required: true },
      { id: "phone", label: "What is your in city phone number?", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what were the charges?", kind: "textarea", required: true },
      { id: "whyCouncil", label: "Why do you want to be apart of city council?", kind: "textarea", required: true },
      { id: "qualified", label: "What makes you qualified to be apart of city council?", kind: "textarea", required: true },
      { id: "noCrime", label: "Do you understand that while you are on the city council team you are not allowed to participate in crime of any kind?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance to be on city council?", kind: "yesno", required: true }
    ]
  },
  {
    key: "lawyer-app",
    title: "Lawyer Application",
    type: "city-hall",
    description: "Apply to practice law in Bloodline RP.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "timezone", label: "What time zone are you in?", kind: "text", required: true },
      { id: "age", label: "How old are you? (IRL)", kind: "text", required: true },
      { id: "icName", label: "What is your name? (IC)", kind: "text", required: true },
      { id: "phone", label: "What is your in city phone number?", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what were the charges?", kind: "textarea", required: true },
      { id: "qualified", label: "What makes you qualified to be a lawyer?", kind: "textarea", required: true },
      { id: "whyLawyer", label: "What makes you want to be a lawyer? (be descriptive here)", kind: "textarea", required: true },
      { id: "noCrime", label: "Do you understand that while you are hired on as a lawyer you are not allowed to participate in crime of any kind?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance?", kind: "yesno", required: true }
    ]
  },
  {
    key: "judge-app",
    title: "Judge Application",
    type: "city-hall",
    description: "Apply for judge responsibilities in city hall.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "timezone", label: "What time zone are you in?", kind: "text", required: true },
      { id: "age", label: "How old are you (IRL)", kind: "text", required: true },
      { id: "icName", label: "What is your name? (IC)", kind: "text", required: true },
      { id: "phone", label: "What is your in city phone number?", kind: "text", required: true },
      { id: "record", label: "Do you have a criminal record? If yes what were the charges?", kind: "textarea", required: true },
      { id: "qualified", label: "What makes you qualified to be a judge?", kind: "textarea", required: true },
      { id: "whyJudge", label: "Why do you want to be a judge? (be descriptive here)", kind: "textarea", required: true },
      { id: "noCrime", label: "Do you understand that while you hold the position as a judge you are not allowed to participate in crime of any kind?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your acceptance?", kind: "yesno", required: true }
    ]
  },
  {
    key: "business-app",
    title: "Business Application",
    type: "business-gang",
    description: "Apply to open an official city business.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "characterName", label: "What is your characters name?", kind: "text", required: true },
      { id: "phone", label: "What is your IC phone number? (if applicable)", kind: "text", required: true },
      { id: "businessType", label: "What type of business are you opening?", kind: "text", required: true },
      { id: "businessName", label: "What is the name of your business?", kind: "text", required: true },
      { id: "alreadyStarted", label: "Have you already started this business?", kind: "yesno", required: true },
      { id: "location", label: "Desired business location", kind: "textarea", required: true },
      { id: "value", label: "What will your business bring to the city?", kind: "textarea", required: true },
      { id: "employees", label: "Employee list (if any)", kind: "textarea", required: true },
      { id: "equipment", label: "What items / equipment do you require from the city to start out?", kind: "textarea", required: true },
      { id: "sopLink", label: "Please provide a link to your business SOP.", kind: "text", required: true },
      { id: "shutdownNotice", label: "Do you understand your business can be shut down if inactive or misused?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your business will be approved and officially added to the city?", kind: "yesno", required: true }
    ]
  },
  {
    key: "gang-app",
    title: "Gang Application",
    type: "business-gang",
    description: "Apply for official gang status and perks.",
    questions: [
      { id: "discordUsername", label: "What is your discord username?", kind: "text", required: true },
      { id: "characterName", label: "What is your characters name?", kind: "text", required: true },
      { id: "phone", label: "What is your IC phone number? (if applicable)", kind: "text", required: true },
      { id: "gangName", label: "What is the name of your gang?", kind: "text", required: true },
      { id: "gangSize", label: "Have you already started your gang? If so how many members do you currently have?", kind: "textarea", required: true },
      { id: "intro", label: "Provide a brief introduction of your gang and its goals, as well as what you plan to do within the city.", kind: "textarea", required: true },
      { id: "rpContribution", label: "How does your gang plan to contribute to the overall RP experience in the city?", kind: "textarea", required: true },
      { id: "longevity", label: "How long do you see you and your gang being apart of Bloodline RP?", kind: "textarea", required: true },
      { id: "inactiveRisk", label: "Do you understand if your whole gang becomes inactive you risk losing all your perks and the official gang status?", kind: "yesno", required: true },
      { id: "acceptanceNotice", label: "Do you understand that submitting this application does not guarantee your gang will be approved? (This does not mean you cant still run your gang unofficially. Keep showing us what your gang brings to the city and reapply in 30 days.)", kind: "yesno", required: true }
    ]
  }
];
