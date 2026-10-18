const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function seedProfessionalReading() {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Clear existing reading data so we can freshly insert professional questions directly based on the Excel vocabulary
  await db.exec('DELETE FROM reading_questions');
  await db.exec('DELETE FROM reading_passages');

  // ==========================================
  // PART 5: 10 câu hỏi ngữ pháp, collocations từ vựng chuẩn từ Sheet Part 5
  // ==========================================
  const p5Questions = [
    {
      id: 'rq_p5_01',
      part: 5,
      question_number: 1,
      question_text: "The annual international business conference will _______ at the Grand Hotel next Thursday at 9:00 A.M.",
      option_a: "take place",
      option_b: "close down",
      option_c: "stop the spread",
      option_d: "leave for",
      correct_option: "A",
      question_type: "Collocation / Phrasal Verb",
      translation: "Hội nghị kinh doanh quốc tế thường niên sẽ diễn ra tại khách sạn Grand Hotel vào thứ Năm tới lúc 9:00 sáng.",
      analysis: "Cụm 'take place' mang nghĩa 'diễn ra, được tổ chức' (xảy ra theo lịch trình sắp xếp). Các phương án khác sai nghĩa: (B) close down (đóng cửa, giải thể), (C) stop the spread (ngăn chặn sự lây lan), (D) leave for (rời đi tới một nơi khác).",
      vocab_highlights: JSON.stringify([
        { term: "take place", meaning: "diễn ra, được tổ chức", pos: "v. phr.", ipa: "/teɪk pleɪs/" },
        { term: "annual conference", meaning: "hội nghị thường niên", pos: "n. phr.", ipa: "/ˈænjuəl ˈkɑːnfərəns/" }
      ])
    },
    {
      id: 'rq_p5_02',
      part: 5,
      question_number: 2,
      question_text: "Due to high operational expenses and declining foot traffic, the downtown branch will _______ permanently next month.",
      option_a: "move forward",
      option_b: "close down",
      option_c: "compensate for",
      option_d: "absorb water",
      correct_option: "B",
      question_type: "Vocabulary / Context",
      translation: "Do chi phí vận hành cao và lượng khách qua lại sụt giảm, chi nhánh trung tâm sẽ đóng cửa vĩnh viễn vào tháng tới.",
      analysis: "Xét ngữ cảnh đóng cửa doanh nghiệp, cụm từ chính xác là (B) close down (ngừng hoạt động, đóng cửa). (A) move forward (tiến về phía trước, xúc tiến), (C) compensate for (bồi thường, bù đắp), (D) absorb water (hút nước).",
      vocab_highlights: JSON.stringify([
        { term: "close down", meaning: "đóng cửa, ngừng hoạt động kinh doanh", pos: "v. phr.", ipa: "/kloʊz daʊn/" },
        { term: "operational expenses", meaning: "chi phí vận hành", pos: "n. phr.", ipa: "/ˌɑːpəˈreɪʃənl ɪkˈspensɪz/" }
      ])
    },
    {
      id: 'rq_p5_03',
      part: 5,
      question_number: 3,
      question_text: "Both applicants interviewed this morning were _______ for the senior project manager position.",
      option_a: "highly qualified",
      option_b: "fixed price",
      option_c: "sharp edges",
      option_d: "ongoing project",
      correct_option: "A",
      question_type: "Collocation / Modifier",
      translation: "Cả hai ứng viên được phỏng vấn sáng nay đều có trình độ cao cho vị trí trưởng ban quản lý dự án.",
      analysis: "Cụm tính từ 'highly qualified' (có trình độ cao, rất đủ năng lực) là một collocation cực kỳ phổ biến trong TOEIC khi nói về ứng viên hoặc nhân sự. (B) fixed price (giá cố định), (C) sharp edges (cạnh sắc nhọn), (D) ongoing project (dự án đang tiến hành).",
      vocab_highlights: JSON.stringify([
        { term: "highly qualified", meaning: "có trình độ cao, chuyên môn cao", pos: "adj. phr.", ipa: "/ˈhaɪli ˈkwɑːlɪfaɪd/" },
        { term: "applicant", meaning: "người nộp đơn, ứng viên", pos: "noun", ipa: "/ˈæplɪkənt/" }
      ])
    },
    {
      id: 'rq_p5_04',
      part: 5,
      question_number: 4,
      question_text: "The Board of Directors voted unanimously to _______ Mr. Mitrakos a substantial bonus for his outstanding leadership.",
      option_a: "award",
      option_b: "absorb",
      option_c: "commence",
      option_d: "compensate",
      correct_option: "A",
      question_type: "Collocation (Verb + Noun)",
      translation: "Hội đồng quản trị đã bỏ phiếu nhất trí trao thưởng cho ông Mitrakos một khoản tiền thưởng lớn vì sự lãnh đạo xuất sắc của ông.",
      analysis: "Cụm 'award a bonus' mang nghĩa 'thưởng tiền thưởng / trao thưởng'. (B) absorb (hấp thụ/hút), (C) commence (bắt đầu), (D) compensate (đi với 'for' mang nghĩa đền bù).",
      vocab_highlights: JSON.stringify([
        { term: "award a bonus", meaning: "thưởng tiền thưởng", pos: "v. phr.", ipa: "/əˈwɔːrd ə ˈboʊnəs/" },
        { term: "unanimously", meaning: "một cách nhất trí, đồng lòng", pos: "adv.", ipa: "/juːˈnænɪməsli/" }
      ])
    },
    {
      id: 'rq_p5_05',
      part: 5,
      question_number: 5,
      question_text: "Job seekers who possess a strong work ethic can often _______ having limited previous work experience.",
      option_a: "compensate for",
      option_b: "cite the cost",
      option_c: "take place",
      option_d: "refrain from",
      correct_option: "A",
      question_type: "Phrasal Verb",
      translation: "Những người tìm việc có đạo đức nghề nghiệp tốt thường có thể bù đắp cho việc thiếu kinh nghiệm làm việc trước đây.",
      analysis: "'compensate for' có nghĩa là 'bù đắp cho, đền bù cho' một thiếu sót hoặc tổn thất. (B) cite the cost (trích dẫn/nêu chi phí), (C) take place (diễn ra), (D) refrain from (kiềm chế, tránh làm gì).",
      vocab_highlights: JSON.stringify([
        { term: "compensate for", meaning: "bù đắp cho, đền bù", pos: "v. phr.", ipa: "/ˈkɑːmpənseɪt fɔːr/" },
        { term: "work ethic", meaning: "đạo đức nghề nghiệp / tinh thần làm việc", pos: "n. phr.", ipa: "/ˈwɜːrk ˌeθɪk/" }
      ])
    },
    {
      id: 'rq_p5_06',
      part: 5,
      question_number: 6,
      question_text: "The marketing department is _______ feedback from customers through a series of online satisfaction surveys.",
      option_a: "actively soliciting",
      option_b: "abruptly changing",
      option_c: "consistently strong",
      option_d: "safely delivered",
      correct_option: "A",
      question_type: "Collocation (Adv + Verb)",
      translation: "Phòng tiếp thị đang tích cực kêu gọi ý kiến phản hồi từ khách hàng thông qua một loạt các cuộc khảo sát mức độ hài lòng trực tuyến.",
      analysis: "'actively solicit' (tích cực kêu gọi/thu thập thông tin, phản hồi, quyên góp). Sau động từ 'is' cần V-ing mang ý chủ động, kết hợp với tân ngữ 'feedback'. Do đó (A) actively soliciting là lựa chọn hoàn hảo.",
      vocab_highlights: JSON.stringify([
        { term: "actively solicit", meaning: "tích cực kêu gọi / thu thập (ý kiến, phản hồi)", pos: "v. phr.", ipa: "/ˈæktɪvli səˈlɪsɪt/" },
        { term: "satisfaction survey", meaning: "khảo sát mức độ hài lòng", pos: "n. phr.", ipa: "/ˌsætɪsˈfækʃn ˈsɜːrveɪ/" }
      ])
    },
    {
      id: 'rq_p5_07',
      part: 5,
      question_number: 7,
      question_text: "Because of safety regulations, all workers must undergo _______ training before operating the newly installed machinery.",
      option_a: "extensive",
      option_b: "padded",
      option_c: "retractable",
      option_d: "farewell",
      correct_option: "A",
      question_type: "Collocation (Adj + Noun)",
      translation: "Vì các quy định an toàn, tất cả công nhân phải trải qua quá trình đào tạo chuyên sâu trước khi vận hành máy móc mới lắp đặt.",
      analysis: "'extensive training' nghĩa là 'đào tạo chuyên sâu / đào tạo trên diện rộng'. (B) padded (có đệm lót), (C) retractable (có thể co rút/thu vào), (D) farewell (chia tay/tạm biệt).",
      vocab_highlights: JSON.stringify([
        { term: "extensive training", meaning: "sự đào tạo chuyên sâu, bài bản", pos: "n. phr.", ipa: "/ɪkˈstensɪv ˈtreɪnɪŋ/" },
        { term: "undergo", meaning: "trải qua (khóa học, kiểm tra, phẫu thuật)", pos: "verb", ipa: "/ˌʌndərˈɡoʊ/" }
      ])
    },
    {
      id: 'rq_p5_08',
      part: 5,
      question_number: 8,
      question_text: "Employees traveling on official company business will receive full _______ for their lodging and meal costs.",
      option_a: "reimbursement",
      option_b: "proprietary",
      option_c: "asset",
      option_d: "preference",
      correct_option: "A",
      question_type: "Business Vocabulary",
      translation: "Nhân viên đi công tác theo việc của công ty sẽ được hoàn trả toàn bộ chi phí ăn ở.",
      analysis: "'reimbursement for' (sự hoàn trả, thanh toán lại tiền đã ứng ra trước). (B) proprietary (độc quyền), (C) asset (tài sản), (D) preference (sự ưu tiên, tùy chọn).",
      vocab_highlights: JSON.stringify([
        { term: "reimbursement for", meaning: "sự hoàn trả / thanh toán lại cho chi phí", pos: "n. phr.", ipa: "/ˌriːɪmˈbɜːrsmənt fɔːr/" },
        { term: "lodging", meaning: "nơi ăn chốn ở / chỗ lưu trú", pos: "noun", ipa: "/ˈlɑːdʒɪŋ/" }
      ])
    },
    {
      id: 'rq_p5_09',
      part: 5,
      question_number: 9,
      question_text: "Throughout her fifteen years with the corporation, Ms. Vance has demonstrated _______ to mentoring junior employees.",
      option_a: "great dedication",
      option_b: "fixed price",
      option_c: "sharp edges",
      option_d: "ongoing project",
      correct_option: "A",
      question_type: "Collocation / Noun Phrase",
      translation: "Trong suốt mười lăm năm làm việc tại tập đoàn, bà Vance đã thể hiện sự cống hiến to lớn trong việc hướng dẫn các nhân viên cấp dưới.",
      analysis: "Cụm danh từ 'great dedication (to sth)' nghĩa là 'sự cống hiến to lớn (đối với điều gì)'. Cấu trúc: 'demonstrate great dedication to V-ing/N'.",
      vocab_highlights: JSON.stringify([
        { term: "great dedication", meaning: "sự cống hiến to lớn / sự tận tâm", pos: "n. phr.", ipa: "/ɡreɪt ˌdedɪˈkeɪʃn/" },
        { term: "mentor", meaning: "cố vấn, hướng dẫn người mới", pos: "verb", ipa: "/ˈmentɔːr/" }
      ])
    },
    {
      id: 'rq_p5_10',
      part: 5,
      question_number: 10,
      question_text: "At Northern Energy, workplace safety must always remain our _______ across all operational facilities.",
      option_a: "top priority",
      option_b: "substitute item",
      option_c: "former owner",
      option_d: "widened space",
      correct_option: "A",
      question_type: "Collocation / Business Idiom",
      translation: "Tại tập đoàn Năng Lượng Northern, an toàn tại nơi làm việc phải luôn là ưu tiên hàng đầu tại mọi cơ sở hoạt động.",
      analysis: "Cụm danh từ 'top priority' (ưu tiên hàng đầu) là cụm từ chuẩn mực nhất trong văn cảnh doanh nghiệp TOEIC. (B) substitute item (hàng thay thế), (C) former owner (chủ cũ), (D) widened space (không gian mở rộng).",
      vocab_highlights: JSON.stringify([
        { term: "top priority", meaning: "ưu tiên hàng đầu", pos: "n. phr.", ipa: "/tɑːp praɪˈɔːrəti/" },
        { term: "operational facilities", meaning: "cơ sở vận hành / nhà máy hoạt động", pos: "n. phr.", ipa: "/ˌɑːpəˈreɪʃənl fəˈsɪlətiz/" }
      ])
    }
  ];

  for (let q of p5Questions) {
    await db.run(`
      INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
      VALUES (?, NULL, 5, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [q.id, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.question_type, q.translation, q.analysis, q.vocab_highlights]);
  }

  // ==========================================
  // PART 6: Đoạn văn Email / Thông Báo công ty (Áp dụng từ vựng Sheet Part 6)
  // ==========================================
  const passageP6Id = 'rp_p6_corp_memo';
  const p6Text = `To: All Branch Managers
From: Karen Walker, Vice President of Human Resources
Date: November 3
Subject: Celebrating Employee Milestones & Portal Upgrade

Dear Colleagues,

[1] _______ celebrate the 30th anniversary of our regional distribution network. Over the past three decades, your tireless dedication and [2] _______ have contributed greatly to our sustained growth. As a small [3] _______, each manager will receive a commemorative plaque and an invitation to our year-end banquet.

Additionally, our IT department will be performing a major system maintenance this weekend. Therefore, please [4] _______ accessing the employee portal between 10:00 P.M. on Saturday and 6:00 A.M. on Sunday.

Rest assured that all pending payroll and direct deposit preferences will remain secure throughout this brief downtime.

Warm regards,
Karen Walker`;

  await db.run(`
    INSERT INTO reading_passages (id, part, title, passage_text, created_at)
    VALUES (?, 6, ?, ?, ?)
  `, [passageP6Id, "Internal Announcement: 30th Anniversary & Portal Upgrade", p6Text, new Date().toISOString()]);

  const p6Questions = [
    {
      id: 'rq_p6_01',
      passage_id: passageP6Id,
      part: 6,
      question_number: 1,
      question_text: "Select the most appropriate opening phrase for blank [1].",
      option_a: "We are delighted to",
      option_b: "We are reluctant to",
      option_c: "We regret to",
      option_d: "We are required to",
      correct_option: "A",
      question_type: "Part 6 Email Opener (Thư báo tin vui)",
      translation: "Chọn cụm mở đầu phù hợp nhất cho chỗ trống [1]: Chúng tôi rất vui mừng được kỷ niệm 30 năm...",
      analysis: "Văn cảnh thông báo kỷ niệm ngày thành lập mang tính tích cực và trang trọng. Cụm 'We are delighted to' (Chúng tôi rất vui mừng được làm gì) là công thức mở đầu kinh điển trong thư từ doanh nghiệp TOEIC. (B) reluctant (miễn cưỡng), (C) regret (tiếc nuối), (D) required (bị bắt buộc).",
      vocab_highlights: JSON.stringify([
        { term: "We are delighted to", meaning: "chúng tôi rất vui mừng được...", pos: "phr.", ipa: "/wiː ɑːr dɪˈlaɪtɪd tuː/" },
        { term: "celebrate your anniversary", meaning: "kỷ niệm ngày thành lập / lễ kỷ niệm", pos: "v. phr.", ipa: "/ˈselɪbreɪt jɔːr ˌænɪˈvɜːrsəri/" }
      ])
    },
    {
      id: 'rq_p6_02',
      passage_id: passageP6Id,
      part: 6,
      question_number: 2,
      question_text: "Select the best noun phrase for blank [2].",
      option_a: "commitment to excellence",
      option_b: "hesitation in decision",
      option_c: "abundance of candidates",
      option_d: "delay of progress",
      correct_option: "A",
      question_type: "Part 6 Business Collocation",
      translation: "Chọn cụm danh từ thích hợp nhất cho chỗ trống [2]: ...sự cống hiến không mệt mỏi và cam kết về sự xuất sắc...",
      analysis: "Cụm danh từ 'commitment to excellence' (cam kết về sự xuất sắc / nỗ lực đạt chất lượng cao nhất) đi kèm với 'tireless dedication' để thể hiện sự đánh giá cao về năng lực làm việc.",
      vocab_highlights: JSON.stringify([
        { term: "commitment to excellence", meaning: "cam kết về sự xuất sắc / tận tâm chất lượng cao", pos: "n. phr.", ipa: "/kəˈmɪtmənt tuː ˈeksələns/" },
        { term: "contributed greatly to", meaning: "đóng góp to lớn vào điều gì", pos: "v. phr.", ipa: "/kənˈtrɪbjuːtɪd ˈɡreɪtli tuː/" }
      ])
    },
    {
      id: 'rq_p6_03',
      passage_id: passageP6Id,
      part: 6,
      question_number: 3,
      question_text: "Select the most suitable phrase for blank [3].",
      option_a: "token of our gratitude",
      option_b: "software upgrade",
      option_c: "substitute item",
      option_d: "retractable case",
      correct_option: "A",
      question_type: "Part 6 Contextual Expression",
      translation: "Chọn cụm từ phù hợp cho chỗ trống [3]: ...như một món quà tri ân nhỏ...",
      analysis: "Cụm 'token of our gratitude' (món quà biểu thị sự biết ơn / vật tượng trưng cho sự tri ân) được bổ nghĩa cho việc tặng kỷ niệm chương (commemorative plaque) và tiệc liên hoan.",
      vocab_highlights: JSON.stringify([
        { term: "token of our gratitude", meaning: "món quà tri ân / vật biểu thị lòng biết ơn", pos: "n. phr.", ipa: "/ˈtoʊkən əv ɑːr ˈɡrætɪtuːd/" }
      ])
    },
    {
      id: 'rq_p6_04',
      passage_id: passageP6Id,
      part: 6,
      question_number: 4,
      question_text: "Select the correct verbal construction for blank [4].",
      option_a: "refrain from",
      option_b: "rely on",
      option_c: "transfer to",
      option_d: "look forward to",
      correct_option: "A",
      question_type: "Part 6 Phrasal Verb + V-ing",
      translation: "Chọn cấu trúc động từ chính xác cho chỗ trống [4]: ...xin vui lòng hạn chế / tránh truy cập vào cổng thông tin nhân viên...",
      analysis: "Cấu trúc 'refrain from + V-ing' mang ý nghĩa lịch sự yêu cầu người nhận 'tránh / không thực hiện' hành động nào đó trong thời gian bảo trì. (B) rely on (phụ thuộc), (C) transfer to (chuyển công tác), (D) look forward to (mong chờ).",
      vocab_highlights: JSON.stringify([
        { term: "refrain from accessing", meaning: "hạn chế truy cập / tránh truy cập", pos: "v. phr.", ipa: "/rɪˈfreɪn frəm ækˈsesɪŋ/" },
        { term: "rest assured that", meaning: "hãy yên tâm rằng...", pos: "phr.", ipa: "/rest əˈʃʊrd ðæt/" }
      ])
    }
  ];

  for (let q of p6Questions) {
    await db.run(`
      INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
      VALUES (?, ?, 6, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [q.id, q.passage_id, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.question_type, q.translation, q.analysis, q.vocab_highlights]);
  }

  // ==========================================
  // PART 7: Đoạn văn Đọc hiểu thư tín thương mại & Hợp đồng (Áp dụng từ vựng Sheet Part 7)
  // ==========================================
  const passageP7Id = 'rp_p7_customer_notice';
  const p7Text = `RIVERSIDE PAVING & VENUE MANAGEMENT
104 Riverbank Road, Kingston
Telephone: (555) 0192-3481
www.riversidepaving.com

MEMORANDUM TO ALL BUILDING TENANTS

Date: August 14
Subject: Facility Improvements & Parking Lot Maintenance

Please be advised that Riverside Paving Company will commence resurfacing the main parking area behind the building on Monday, August 21. Citing the cost of recurring repairs on weathered asphalt, the building owners decided to invest in a comprehensive overhaul to keep the property a thriving business hub.

Key Schedule Details:
• All vehicles must be removed by 7:00 P.M. on Sunday, August 20, for the heavy machinery to operate safely.
• When work is finished, note that all parking spaces will be widened to accommodate larger commercial vehicles. Your newly assigned parking spot will be moved more than 20 meters from your previous one.
• Ten temporary spaces will be provided across the street at the civic auditorium, ensuring there is plenty to go around for essential delivery vehicles.
• Crews will smooth all sharp edges and install updated reflective signage by Thursday afternoon.

For any inquiries or general assistance regarding special parking accommodations, please contact Jasen Norton before his upcoming transfer to our corporate headquarters.

We appreciate your patience and cooperation during these necessary renovations.`;

  await db.run(`
    INSERT INTO reading_passages (id, part, title, passage_text, created_at)
    VALUES (?, 7, ?, ?, ?)
  `, [passageP7Id, "Notice to Tenants: Parking Facility Upgrades", p7Text, new Date().toISOString()]);

  const p7Questions = [
    {
      id: 'rq_p7_01',
      passage_id: passageP7Id,
      part: 7,
      question_number: 1,
      question_text: "What is the primary purpose of the notice?",
      option_a: "To notify tenants about scheduled parking area renovations",
      option_b: "To announce the closure of an antique furniture shop",
      option_c: "To solicit feedback about employee bonus compensation",
      option_d: "To promote a new line of software products",
      correct_option: "A",
      question_type: "Part 7 Main Purpose (Mục đích chính)",
      translation: "Mục đích chính của bản thông báo là gì? -> Để thông báo cho người thuê về đợt cải tạo bãi đậu xe theo lịch trình.",
      analysis: "Đoạn 1 nêu rõ: 'Riverside Paving Company will commence resurfacing the main parking area...'. Do đó phương án (A) phản ánh chính xác mục đích trung tâm của văn bản.",
      vocab_highlights: JSON.stringify([
        { term: "resurface the parking area", meaning: "làm lại bề mặt bãi đỗ xe", pos: "v. phr.", ipa: "/ˌriːˈsɜːrfɪs ðə ˈpɑːrkɪŋ ˈeriə/" },
        { term: "commence", meaning: "bắt đầu, khởi công", pos: "verb", ipa: "/kəˈmens/" }
      ])
    },
    {
      id: 'rq_p7_02',
      passage_id: passageP7Id,
      part: 7,
      question_number: 2,
      question_text: "Why did the building owners decide to undertake this project now?",
      option_a: "Citing the cost of frequent recurring repairs",
      option_b: "Because of a mandatory government directive",
      option_c: "To prepare for a farewell dinner celebration",
      option_d: "Owing to an abrupt drop in commercial rent",
      correct_option: "A",
      question_type: "Part 7 Detail Question (Nguyên nhân / Chi tiết)",
      translation: "Tại sao các chủ tòa nhà quyết định thực hiện dự án này vào thời điểm hiện tại? -> Do trích dẫn chi phí sửa chữa định kỳ liên tục.",
      analysis: "Đoạn 1 chỉ rõ: 'Citing the cost of recurring repairs on weathered asphalt, the building owners decided to invest in a comprehensive overhaul...'. Cụm 'citing the cost' tương ứng chuẩn xác với phương án (A).",
      vocab_highlights: JSON.stringify([
        { term: "citing the cost", meaning: "trích dẫn chi phí / đưa ra lý do vì chi phí", pos: "v. phr.", ipa: "/ˈsaɪtɪŋ ðə kɔːst/" },
        { term: "thriving business", meaning: "doanh nghiệp đang phát triển mạnh", pos: "n. phr.", ipa: "/ˈθraɪvɪŋ ˈbɪznəs/" }
      ])
    },
    {
      id: 'rq_p7_03',
      passage_id: passageP7Id,
      part: 7,
      question_number: 3,
      question_text: "According to the notice, how will the newly completed parking area differ?",
      option_a: "The parking stalls will be widened",
      option_b: "Parking fees will be dramatically increased",
      option_c: "It will be covered with a retractable canvas roof",
      option_d: "It will be reserved solely for civic auditorium visitors",
      correct_option: "A",
      question_type: "Part 7 Detail / Paraphrase",
      translation: "Theo thông báo, bãi đỗ xe mới hoàn thiện sẽ có điểm gì khác biệt? -> Các ô đỗ xe sẽ được mở rộng ra.",
      analysis: "Dấu gạch đầu dòng thứ 2 ghi rõ: 'note that all parking spaces will be widened to accommodate larger commercial vehicles'. Do đó (A) là câu trả lời đúng.",
      vocab_highlights: JSON.stringify([
        { term: "widened spaces", meaning: "các chỗ / ô đỗ xe được mở rộng", pos: "n. phr.", ipa: "/ˈwaɪdnd speɪsɪz/" },
        { term: "previous one", meaning: "cái trước đó / vị trí trước đây", pos: "n. phr.", ipa: "/ˈpriːviəs wʌn/" }
      ])
    },
    {
      id: 'rq_p7_04',
      passage_id: passageP7Id,
      part: 7,
      question_number: 4,
      question_text: "What will happen to Mr. Jasen Norton in the near future?",
      option_a: "He will transfer to company headquarters",
      option_b: "He will become an angel investor",
      option_c: "He will start his own paving business",
      option_d: "He will retire from venue management",
      correct_option: "A",
      question_type: "Part 7 Inference / Personnel Update",
      translation: "Điều gì sẽ xảy ra với ông Jasen Norton trong tương lai gần? -> Ông ấy sẽ chuyển công tác về trụ sở chính của công ty.",
      analysis: "Dòng áp chót chỉ rõ: 'contact Jasen Norton before his upcoming transfer to our corporate headquarters'. (A) là câu trả lời trực tiếp và chính xác nhất.",
      vocab_highlights: JSON.stringify([
        { term: "transfer to", meaning: "chuyển công tác đến (chi nhánh khác)", pos: "v. phr.", ipa: "/trænsˈfɜːr tuː/" },
        { term: "plenty to go around", meaning: "đủ dồi dào cho tất cả mọi người", pos: "phr.", ipa: "/ˈplenti tuː ɡoʊ əˈraʊnd/" }
      ])
    }
  ];

  for (let q of p7Questions) {
    await db.run(`
      INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
      VALUES (?, ?, 7, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [q.id, q.passage_id, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.question_type, q.translation, q.analysis, q.vocab_highlights]);
  }

  console.log("Seeding complete!");
  const qSummary = await db.all('SELECT part, COUNT(*) as c FROM reading_questions GROUP BY part');
  console.log("Questions per part in DB:", qSummary);

  await db.close();
}

seedProfessionalReading().catch(console.error);
