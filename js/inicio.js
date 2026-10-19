/* Arranque: primer render de la pantalla de ajustes y pantalla de inicio.
   Va después de todos los módulos (usa funciones de liga, eliminatoria, plantillas, etc.). */
refreshCount();
refreshLegCards();
updateSteps();
refreshStartBtn();
refreshBudgetNote();
refreshFreeMarketBox();
refreshBotOptions();
goToScreen("home");
