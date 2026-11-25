"""LOCAL TESTING ONLY: writes db/demo.sql with the sample stories from the old static site.

Never run demo.sql against the production database. Usage:
  python3 db/build_demo.py
  node --env-file=.dev.vars db/run-sql.mjs db/demo.sql
"""
import time
from pathlib import Path

def q(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"

# (category slug, city slug or None, title, summary, minutes ago, flags)
NEWS = [
    ("desh", None, "संसद के शीतकालीन सत्र से पहले सर्वदलीय बैठक, सरकार ने 18 विधेयक पेश करने की तैयारी बताई", "बैठक में विपक्ष ने महंगाई और रोज़गार पर अलग से चर्चा की मांग रखी। सत्र 1 दिसंबर से शुरू होगा।", 10, "featured,breaking"),
    ("desh", None, "उत्तर भारत में शीतलहर की दस्तक, मौसम विभाग ने 6 राज्यों में घने कोहरे का अलर्ट जारी किया", "अगले 72 घंटों में न्यूनतम तापमान 3 से 5 डिग्री तक गिर सकता है।", 25, "breaking"),
    ("videsh", None, "जलवायु शिखर सम्मेलन में 40 देशों ने स्वच्छ ऊर्जा कोष पर सहमति जताई", "विकासशील देशों के लिए 120 अरब डॉलर के फंड का प्रस्ताव मंजूर।", 40, ""),
    ("khel", None, "तीसरे वनडे में भारत की 7 विकेट से जीत, सीरीज़ 2-1 से अपने नाम की", "युवा सलामी बल्लेबाज़ ने 112 गेंदों पर नाबाद 128 रन बनाए।", 60, "trending"),
    ("manoranjan", None, "नई फिल्म 'धूप के रंग' ने पहले वीकेंड में 85 करोड़ का कारोबार किया", "छोटे बजट की इस फैमिली ड्रामा फिल्म को दर्शकों का भरपूर प्यार मिल रहा है।", 70, ""),
    ("karobar", None, "सेंसेक्स 620 अंक उछला, बैंकिंग और आईटी शेयरों में जोरदार खरीदारी", "विदेशी निवेशकों की वापसी से बाज़ार में लगातार तीसरे दिन तेज़ी रही।", 120, ""),
    ("tech", None, "देसी स्टार्टअप ने लॉन्च किया हिंदी में बात करने वाला एआई असिस्टेंट", "किसानों और छोटे दुकानदारों के लिए 12 भारतीय भाषाओं में मुफ्त सेवा।", 130, ""),
    ("desh", "lucknow", "लखनऊ मेट्रो के दूसरे चरण को मंजूरी, चारबाग से वसंतकुंज तक बनेगा नया कॉरिडोर", "11 किलोमीटर लंबे रूट पर 12 स्टेशन होंगे, 2029 तक काम पूरा करने का लक्ष्य।", 180, ""),
    ("shiksha", None, "बोर्ड परीक्षा 2027 की डेटशीट जारी, 18 फरवरी से शुरू होंगे पेपर", "छात्र आधिकारिक पोर्टल से पूरा टाइम टेबल डाउनलोड कर सकते हैं।", 190, ""),
    ("dharm", "varanasi", "देव दीपावली पर काशी के 84 घाटों पर जलेंगे 21 लाख दीये", "प्रशासन ने श्रद्धालुओं की सुविधा के लिए विशेष यातायात योजना बनाई।", 240, ""),
    ("lifestyle", None, "सर्दियों में इम्युनिटी बढ़ाने के लिए डाइट में शामिल करें ये 6 देसी चीज़ें", "पोषण विशेषज्ञों के अनुसार गुड़, तिल और आंवला बेहद फायदेमंद हैं।", 250, ""),
    ("videsh", None, "अंतरिक्ष एजेंसी का नया मिशन चंद्रमा के दक्षिणी ध्रुव पर सफलतापूर्वक उतरा", "लैंडर अगले 14 दिनों तक सतह की मिट्टी और बर्फ का अध्ययन करेगा।", 300, ""),
    ("khel", None, "राष्ट्रीय खेलों में यूपी के पहलवानों ने जीते 5 स्वर्ण पदक", "महिला वर्ग में 19 वर्षीय पहलवान ने फाइनल में शानदार जीत दर्ज की।", 310, ""),
    ("manoranjan", None, "वेब सीरीज़ 'गलियों का शहर' का दूसरा सीज़न 12 दिसंबर को होगा रिलीज़", "ट्रेलर को 24 घंटे में 3 करोड़ से ज़्यादा बार देखा गया।", 360, ""),
    ("karobar", None, "सोना 1,200 रुपये सस्ता, शादी के सीज़न में खरीदारों को राहत", "चांदी भी 2,500 रुपये प्रति किलो गिरी।", 370, ""),
    ("tech", None, "5जी नेटवर्क अब देश के 98% ज़िलों में, ग्रामीण इलाकों में तेज़ी से विस्तार", "दूरसंचार विभाग ने ताज़ा कवरेज रिपोर्ट जारी की।", 420, ""),
    ("desh", "delhi", "नई रेल सेवा: दिल्ली से वाराणसी के बीच चलेगी दूसरी सेमी हाई-स्पीड ट्रेन", "यात्रा का समय घटकर 7 घंटे 30 मिनट रह जाएगा।", 430, ""),
    ("desh", "kanpur", "कानपुर में गंगा बैराज पर नया पुल जनवरी से खुलेगा, जाम से मिलेगी मुक्ति", "नगर निगम ने अंतिम निरीक्षण पूरा किया।", 480, ""),
    ("shiksha", None, "प्रतियोगी परीक्षाओं के लिए राज्य सरकार की मुफ्त कोचिंग योजना में आवेदन शुरू", "पहले चरण में 50 हज़ार छात्रों को मौका मिलेगा।", 490, ""),
    ("lifestyle", "dehradun", "वीकेंड ट्रिप के लिए उत्तराखंड की 5 कम भीड़ वाली खूबसूरत जगहें", "दिल्ली से 6–8 घंटे की दूरी पर हैं ये पहाड़ी ठिकाने।", 540, ""),
    ("dharm", None, "मार्गशीर्ष माह के व्रत और त्योहार: जानिए पूरी सूची और शुभ मुहूर्त", "इस महीने एकादशी, प्रदोष और पूर्णिमा पर विशेष योग बन रहे हैं।", 550, ""),
    ("videsh", None, "खाड़ी देशों में भारतीय कामगारों के लिए नया वीज़ा नियम लागू", "ऑनलाइन आवेदन प्रक्रिया अब 5 दिन में पूरी होगी।", 600, ""),
    ("khel", "lucknow", "हॉकी लीग: फाइनल में पहुंची लखनऊ की टीम, रविवार को खिताबी मुकाबला", "सेमीफाइनल में 4-2 से जीत।", 610, ""),
    ("manoranjan", "patna", "लोकगायिका को मिलेगा राष्ट्रीय कला सम्मान, अवधी गीतों को दिलाई पहचान", "40 वर्षों से लोक संगीत की सेवा कर रही हैं।", 660, ""),
]

BODY = ("<p>{s}</p><p>अधिकारियों ने बताया कि इस संबंध में सभी ज़रूरी तैयारियां पूरी कर ली गई हैं और आने वाले दिनों में इसका असर साफ दिखाई देगा। "
        "स्थानीय लोगों ने इस फैसले का स्वागत किया है।</p><h2>विशेषज्ञों की राय</h2><p>विशेषज्ञों का मानना है कि यह कदम लंबे समय में फायदेमंद साबित होगा। "
        "हालांकि कुछ लोगों ने इसके क्रियान्वयन को लेकर सवाल भी उठाए हैं।</p><p>NewsPort Express इस खबर पर लगातार नज़र बनाए हुए है। ताज़ा अपडेट के लिए जुड़े रहें।</p>")

now = int(time.time() * 1000)
out = ["-- LOCAL TESTING ONLY. Sample stories; never run on production.", "DELETE FROM articles WHERE slug LIKE 'demo-%';"]
for i, (cat, city, title, summary, mins, flags) in enumerate(NEWS):
    ts = now - mins * 60_000
    loc = ("(SELECT d.state_id FROM cities c JOIN districts d ON d.id = c.district_id WHERE c.slug = {0} LIMIT 1), "
           "(SELECT c.district_id FROM cities c WHERE c.slug = {0} LIMIT 1), (SELECT id FROM cities WHERE slug = {0} LIMIT 1)").format(q(city)) if city else "NULL, NULL, NULL"
    out.append(
        "INSERT INTO articles (slug, type, title, summary, content, category_id, state_id, district_id, city_id, byline, status, "
        "is_breaking, is_featured, is_trending, published_at, created_at, updated_at, keywords) VALUES ("
        f"{q(f'demo-{i + 1}')}, 'news', {q(title)}, {q(summary)}, {q(BODY.format(s=summary))}, "
        f"(SELECT id FROM categories WHERE slug = {q(cat)}), {loc}, 'NewsPort Express डेस्क', 'published', "
        f"{str('breaking' in flags).lower()}, {str('featured' in flags).lower()}, {str('trending' in flags).lower()}, {ts}, {ts}, {ts}, NULL);"
    )
VIDEOS = [("desh", "ग्राउंड रिपोर्ट: कोहरे में कैसे चल रही हैं ट्रेनें", "https://www.youtube.com/watch?v=aqz-KE-bpKQ")]
for j, (cat, title, url) in enumerate(VIDEOS):
    ts = now - (700 + j) * 60_000
    out.append(
        "INSERT INTO articles (slug, type, title, summary, content, category_id, byline, status, video_url, published_at, created_at, updated_at) VALUES ("
        f"{q(f'demo-video-{j + 1}')}, 'video', {q(title)}, {q('वीडियो रिपोर्ट')}, '<p>वीडियो रिपोर्ट।</p>', (SELECT id FROM categories WHERE slug = {q(cat)}), "
        f"'NewsPort Express डेस्क', 'published', {q(url)}, {ts}, {ts}, {ts});"
    )
Path(__file__).with_name("demo.sql").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"wrote {len(out) - 2} demo articles")
