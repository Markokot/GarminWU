import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  Watch,
  BarChart3,
  MessageSquare,
  Dumbbell,
  AlertTriangle,
  ExternalLink,
  Key,
  Lock,
  FlaskConical,
} from "lucide-react";

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold" data-testid="text-faq-title">FAQ / Инструкция</h1>
        <p className="text-sm text-muted-foreground">
          Ответы на частые вопросы и пошаговые инструкции по работе с GarminCoach AI
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Общие вопросы</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="what-is">
              <AccordionTrigger data-testid="faq-what-is">
                Что такое GarminCoach AI?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    GarminCoach AI — это персональный AI-тренер, который помогает создавать структурированные
                    тренировки и отправлять их на ваши спортивные часы или в Zwift.
                  </p>
                  <p>
                    Вы описываете тренировку простым языком (например, «бег 40 минут с интервалами по 400 метров»),
                    а AI генерирует готовую структурированную тренировку с разминкой, интервалами и заминкой.
                  </p>
                  <p>
                    Тренировки можно отправлять напрямую на часы Garmin через Garmin Connect, или на
                    Zwift / Polar / Suunto / COROS / Huawei через интеграцию с Intervals.icu.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sports">
              <AccordionTrigger data-testid="faq-sports">
                Какие виды спорта поддерживаются?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Сейчас поддерживаются:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Бег</strong> — от лёгких пробежек до сложных интервальных тренировок</li>
                    <li><strong>Велосипед</strong> — в том числе тренировки на станке и в Zwift</li>
                    <li><strong>Плавание</strong> — тренировки в бассейне и на открытой воде</li>
                    <li><strong>Триатлон</strong> — подготовка к соревнованиям по триатлону и Ironman</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-ai-works">
              <AccordionTrigger data-testid="faq-how-ai-works">
                Как работает AI-тренер?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    AI-тренер анализирует вашу историю активностей в Garmin (последние 10 тренировок),
                    учитывает ваш профиль (уровень подготовки, возраст, травмы, рекорды) и ведёт
                    диалог, помогая подобрать оптимальную тренировку.
                  </p>
                  <p>
                    Тренер следует правилу 80/20 (80% тренировок в лёгкой зоне, 20% интенсивных)
                    и может не согласиться с вами, если ваш запрос противоречит принципам безопасных тренировок:
                    слишком резкое увеличение объёма, ежедневные интенсивные тренировки, нереалистичные цели.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Watch className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Garmin Connect</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="garmin-connect">
              <AccordionTrigger data-testid="faq-garmin-connect">
                Как подключить Garmin?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Перейдите в раздел <strong>Настройки</strong> и введите email и пароль от вашего
                    аккаунта Garmin Connect (того же, что используете на connect.garmin.com или в приложении
                    Garmin Connect на телефоне).
                  </p>
                  <p>
                    После подключения вы сможете получать данные о ваших последних активностях
                    и отправлять тренировки прямо на часы Garmin.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="garmin-block">
              <AccordionTrigger data-testid="faq-garmin-block">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>Garmin заблокировал мой логин. Что делать?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Garmin Connect чувствителен к частым подключениям через сторонние приложения.
                    Если вы видите ошибку вроде «аккаунт временно заблокирован» или «слишком много попыток» —
                    не паникуйте, это временная блокировка.
                  </p>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <p className="font-medium text-foreground">Что нужно сделать:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Подождите <strong>15-30 минут</strong> — блокировка снимается автоматически</li>
                      <li>Зайдите на <a href="https://connect.garmin.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">connect.garmin.com</a> через браузер и убедитесь, что можете войти</li>
                      <li>Если Garmin просит пройти капчу или подтвердить email — сделайте это на сайте Garmin</li>
                      <li>После этого вернитесь в GarminCoach AI и переподключитесь в <strong>Настройках</strong></li>
                    </ol>
                  </div>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <p className="font-medium text-foreground">Как избежать блокировки:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Не нажимайте «Подключить» многократно подряд</li>
                      <li>Если подключение не прошло с первого раза — подождите пару минут</li>
                      <li>Не отключайте и не подключайте Garmin слишком часто</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="garmin-push">
              <AccordionTrigger data-testid="faq-garmin-push">
                Как тренировка попадает на часы Garmin?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Когда вы отправляете тренировку:</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Тренировка загружается в ваш Garmin Connect</li>
                    <li>Garmin Connect синхронизирует её с часами через Bluetooth (через приложение на телефоне) или Wi-Fi</li>
                    <li>На часах тренировка появится в разделе <strong>Тренировки</strong></li>
                  </ol>
                  <p>
                    Убедитесь, что приложение Garmin Connect на телефоне запущено и часы синхронизированы.
                    Обычно тренировка появляется на часах в течение нескольких минут.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Intervals.icu</h2>
            <Badge variant="secondary" className="text-xs">
              <FlaskConical className="w-3 h-3 mr-1" />
              Experimental
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="intervals-what">
              <AccordionTrigger data-testid="faq-intervals-what">
                Что такое Intervals.icu и зачем он нужен?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer" className="text-primary underline">Intervals.icu</a> — это
                    бесплатная платформа для анализа тренировок и планирования. Она поддерживает
                    синхронизацию тренировок с множеством устройств и сервисов.
                  </p>
                  <p>
                    Через Intervals.icu вы можете отправлять тренировки на:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Zwift</strong> — велотренажёр-симулятор</li>
                    <li><strong>Garmin</strong> — альтернативный способ синхронизации</li>
                    <li><strong>Polar</strong> — часы и датчики Polar</li>
                    <li><strong>Suunto</strong> — часы Suunto</li>
                    <li><strong>COROS</strong> — часы COROS</li>
                    <li><strong>Huawei</strong> — часы Huawei</li>
                  </ul>
                  <p>
                    Это полезно, если у вас не Garmin, или если вы хотите тренироваться в Zwift.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-register">
              <AccordionTrigger data-testid="faq-intervals-register">
                Как зарегистрироваться на Intervals.icu?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      Перейдите на <a href="https://intervals.icu/signup" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">intervals.icu/signup <ExternalLink className="w-3 h-3" /></a>
                    </li>
                    <li>Зарегистрируйтесь с помощью email или аккаунта Strava / Garmin Connect</li>
                    <li>После регистрации подключите источник данных (Strava, Garmin Connect и т.д.) — это нужно для анализа тренировок в Intervals.icu</li>
                    <li>Настройте синхронизацию с вашим устройством (Zwift, Garmin, Polar и т.д.) в разделе настроек Intervals.icu</li>
                  </ol>
                  <p>Регистрация и использование Intervals.icu бесплатны.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-api-key">
              <AccordionTrigger data-testid="faq-intervals-api-key">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Как получить API ключ Intervals.icu?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Для подключения вам понадобятся <strong>Athlete ID</strong> и <strong>API Key</strong>:</p>
                  <div className="bg-muted rounded-md p-3 space-y-3">
                    <p className="font-medium text-foreground">Пошаговая инструкция:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        Войдите в свой аккаунт на <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer" className="text-primary underline">intervals.icu</a>
                      </li>
                      <li>
                        Нажмите на свой профиль (иконка в левом нижнем углу) и выберите <strong>Settings</strong> (Настройки)
                      </li>
                      <li>
                        Перейдите в раздел <strong>Developer Settings</strong> (Настройки разработчика). Он находится внизу страницы настроек
                      </li>
                      <li>
                        Ваш <strong>Athlete ID</strong> отображается в виде буквы «i» и числа (например, <code>i12345</code>). Скопируйте его
                      </li>
                      <li>
                        Нажмите <strong>Generate API Key</strong> (Создать API ключ). Скопируйте сгенерированный ключ — <em>он показывается только один раз!</em>
                      </li>
                      <li>
                        Перейдите в <strong>Настройки</strong> GarminCoach AI и введите Athlete ID и API Key в разделе Intervals.icu
                      </li>
                    </ol>
                  </div>
                  <div className="bg-muted rounded-md p-3 space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Важно
                    </p>
                    <p>
                      Если вы потеряли API ключ, вы можете сгенерировать новый в Developer Settings на Intervals.icu.
                      Старый ключ перестанет работать, и вам нужно будет обновить его в настройках GarminCoach AI.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-athlete-id">
              <AccordionTrigger data-testid="faq-intervals-athlete-id">
                Где найти Athlete ID в Intervals.icu?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Athlete ID можно найти несколькими способами:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>В <strong>Developer Settings</strong> — он отображается рядом с кнопкой генерации API ключа</li>
                    <li>В URL-адресе вашего профиля на Intervals.icu — он выглядит как <code>i12345</code></li>
                    <li>На главной странице Intervals.icu после входа — в левой панели под именем</li>
                  </ul>
                  <p>Athlete ID всегда начинается с буквы <strong>i</strong>, за которой следуют цифры.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-zwift">
              <AccordionTrigger data-testid="faq-intervals-zwift">
                Как отправить тренировку в Zwift через Intervals.icu?
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm text-muted-foreground">
                  <p>
                    Если у вас настроена автоматическая синхронизация между Intervals.icu и Zwift, тренировка может
                    появиться в Zwift автоматически.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Безопасность и данные</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="security-garmin">
              <AccordionTrigger data-testid="faq-security-garmin">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Безопасно ли вводить пароль Garmin?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Да. Ваш пароль Garmin Connect шифруется с помощью алгоритма <strong>AES-256-GCM</strong> —
                    это тот же стандарт шифрования, который используют банки и военные организации.
                  </p>
                  <p>
                    Пароль никогда не хранится в открытом виде, не передаётся третьим лицам
                    и не отображается в интерфейсе. Он используется исключительно для авторизации
                    в Garmin Connect для получения ваших активностей и отправки тренировок.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="security-intervals">
              <AccordionTrigger data-testid="faq-security-intervals">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Безопасно ли вводить API ключ Intervals.icu?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Да. API ключ Intervals.icu шифруется тем же алгоритмом <strong>AES-256-GCM</strong>,
                    что и пароль Garmin. Ключ хранится в зашифрованном виде и используется только
                    для отправки тренировок в ваш аккаунт Intervals.icu.
                  </p>
                  <p>
                    API ключ Intervals.icu имеет ограниченные права — он может только читать и записывать
                    данные тренировок, но не может изменить ваш пароль или удалить аккаунт.
                    Вы всегда можете отозвать ключ в настройках Intervals.icu и сгенерировать новый.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-storage">
              <AccordionTrigger data-testid="faq-data-storage">
                Где хранятся мои данные?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Все данные (учётные записи, тренировки, история чата) хранятся на сервере
                    в зашифрованном виде. Чувствительные данные (пароли, API ключи) дополнительно
                    защищены шифрованием AES-256-GCM.
                  </p>
                  <p>
                    Данные не передаются третьим лицам, кроме случаев прямого
                    взаимодействия с Garmin Connect и Intervals.icu по вашему запросу.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Тренировки</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="create-workout">
              <AccordionTrigger data-testid="faq-create-workout">
                Как создать тренировку?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Перейдите в раздел <strong>AI Тренер</strong> и опишите тренировку обычным языком.
                    Например:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>«Лёгкий бег 40 минут на пульсе 130-140»</li>
                    <li>«Интервалы 8 по 400 метров с отдыхом 90 секунд»</li>
                    <li>«Велотренировка на станке 1 час с темповым блоком»</li>
                    <li>«Тренировка в бассейне 2000 метров»</li>
                  </ul>
                  <p>
                    AI-тренер создаст структурированную тренировку, которую можно сохранить
                    и отправить на часы или в Zwift.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="edit-workout">
              <AccordionTrigger data-testid="faq-edit-workout">
                Можно ли изменить тренировку после создания?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Да! Просто попросите AI-тренера внести изменения в чате. Например:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>«Сделай разминку длиннее — 15 минут вместо 10»</li>
                    <li>«Добавь ещё 2 повтора интервалов»</li>
                    <li>«Снизь целевой пульс до 125-135»</li>
                    <li>«Перенеси тренировку на среду»</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="schedule-workout">
              <AccordionTrigger data-testid="faq-schedule-workout">
                Как запланировать тренировку на конкретный день?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Упомяните дату в разговоре с AI-тренером — он автоматически установит дату тренировки.
                    Например: «Создай тренировку на завтра» или «Интервалы на среду».
                  </p>
                  <p>
                    При отправке на Garmin Connect или Intervals.icu тренировка будет запланирована на указанную дату
                    и появится в вашем тренировочном календаре.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="profile-importance">
              <AccordionTrigger data-testid="faq-profile-importance">
                Зачем заполнять профиль спортсмена?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Чем больше информации о вас знает AI-тренер, тем точнее и безопаснее будут
                    рекомендации. В профиле вы можете указать:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Уровень подготовки</strong> — от новичка до элитного спортсмена</li>
                    <li><strong>Возраст</strong> — для расчёта безопасных пульсовых зон</li>
                    <li><strong>Объём тренировок</strong> — сколько часов в неделю вы тренируетесь</li>
                    <li><strong>Травмы</strong> — чтобы тренер учитывал ограничения</li>
                    <li><strong>Рекорды</strong> — для калибровки интенсивности</li>
                    <li><strong>Цели</strong> — подготовка к конкретному старту или общая форма</li>
                  </ul>
                  <p>
                    Заполнить профиль можно в разделе <strong>Настройки</strong>.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
