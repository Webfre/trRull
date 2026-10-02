import './SettingsWelcome.css'

export default function SettingsWelcome({ imageUrl }: { imageUrl: string }) {
  return <section className="settings-welcome" aria-labelledby="welcome-coach-title">
    <img className="welcome-coach" src={imageUrl} width="1122" height="1402" alt="Тренер приветствует тебя и показывает большой палец" />
    <div className="welcome-speech">
      <h3 id="welcome-coach-title">Чё кого, бро? Осваивайся!</h3>
      <p>Вот настройки рулетки: <strong>галочками выбирай упражнения</strong>, а в полях «от» и «до» задавай объём.</p>
      <p><strong>Начни с умеренных значений.</strong> Освоишься — постепенно добавляй нагрузку. Всё можно поменять через «Настроить рулетку» на главной.</p>
      <p className="welcome-sendoff">Помни про восстановление: отдых — тоже часть тренировки. Удачи, бро!</p>
    </div>
  </section>
}
