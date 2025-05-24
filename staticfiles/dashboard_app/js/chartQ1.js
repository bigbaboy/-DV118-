// chartQ1.js

// Đảm bảo hàm này được định nghĩa ở cấp độ global
// và nhận đủ 3 tham số: containerSelector, tooltipElement, và dataPath
async function drawChartQ1(containerSelector, tooltipElement, dataPath) {
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    // Tiêu đề cho biểu đồ
    vizContainer.append("h4")
        .style("text-align", "center")
        .style("margin-bottom", "20px")
        .text("Tổng quan doanh thu và biên lợi nhuận theo quốc gia (Top 5)"); // Tiêu đề cụ thể cho biểu đồ này

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Sales = +d.Sales; // Chuyển Sales sang số
            d.Profit = +d.Profit; // Chuyển Profit sang số
        });

        // Gom nhóm theo Country, tính tổng Sales và tổng Profit
        const countrySummaryRollup = d3.rollup(allData,
            v => ({
                Total_Sales: d3.sum(v, d => d.Sales),
                Total_Profit: d3.sum(v, d => d.Profit)
            }),
            d => d.Country
        );

        // Chuyển Map thành mảng các object, tính Biên lợi nhuận tổng thể
        let dataForChart = Array.from(countrySummaryRollup, ([key, value]) => ({
            Country: key,
            Total_Sales: value.Total_Sales,
            Total_Profit: value.Total_Profit,
            Profit_Margin_Overall: (value.Total_Sales !== 0) ? (value.Total_Profit / value.Total_Sales) * 100 : 0
        }));

        // Sắp xếp theo Total_Sales giảm dần và lấy top 5
        dataForChart.sort((a, b) => b.Total_Sales - a.Total_Sales);
        dataForChart = dataForChart.slice(0, 5);

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có đủ dữ liệu quốc gia để vẽ biểu đồ.</p>");
            return;
        }

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT KẾT HỢP ĐƯỜNG ---
        const margin = { top: 30, right: 70, bottom: 70, left: 90 }; // Tăng bottom margin cho tên nước
        const containerRect = vizContainer.node().getBoundingClientRect();
        const width = (containerRect.width > 0 ? containerRect.width * 0.95 : 800) - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis (Tên Quốc gia)
        const x = d3.scaleBand()
            .range([0, width])
            .domain(dataForChart.map(d => d.Country))
            .padding(0.3); // Tăng padding cho cột rộng hơn chút

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-40)") // Xoay nhẹ tên nước
                .style("font-size", "10px");

        // Y1 Axis (Doanh thu - cho cột)
        const y1Max = d3.max(dataForChart, d => d.Total_Sales);
        const y1 = d3.scaleLinear()
            .domain([0, y1Max > 0 ? y1Max * 1.1 : 1]) // Mở rộng domain một chút, tránh 0
            .range([height, 0]);

        const y1Axis = svg.append("g")
            .call(d3.axisLeft(y1).ticks(5).tickFormat(d3.format("$,.0s"))); // Định dạng tiền tệ (100K, 1M)

        y1Axis.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 25) // Điều chỉnh vị trí
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "steelblue")
            .style("font-size", "12px")
            .text("Tổng Doanh thu ($)");

        // Vẽ các cột Doanh thu
        const bars = svg.selectAll(".bar-country-sales")
            .data(dataForChart)
            .join("rect")
              .attr("class", "bar-country-sales")
              .attr("x", d => x(d.Country))
              .attr("y", d => y1(d.Total_Sales))
              .attr("width", x.bandwidth())
              .attr("height", d => height - y1(d.Total_Sales))
              .attr("fill", "steelblue")
              .style("cursor", "pointer");

        // Y2 Axis (Biên lợi nhuận - cho đường)
        const profitMargins = dataForChart.map(d => d.Profit_Margin_Overall);
        // Xác định domain cho trục Y2, đảm bảo 0% nằm trong khoảng nếu có cả âm và dương
        let y2Min = d3.min(profitMargins);
        let y2Max = d3.max(profitMargins);
        if (y2Min > 0) y2Min = 0; // Nếu tất cả margin > 0, bắt đầu trục từ 0
        if (y2Max < 0 && y2Max !== undefined) y2Max = 0; // Nếu tất cả margin < 0, kết thúc trục ở 0
        if (y2Min === undefined) y2Min = -10; // Giá trị mặc định nếu không có dữ liệu
        if (y2Max === undefined) y2Max = 10;

        const y2Padding = (y2Max - y2Min) * 0.1; // 10% padding
        
        const y2 = d3.scaleLinear()
            .domain([y2Min - y2Padding, y2Max + y2Padding])
            .range([height, 0]);

        const y2Axis = svg.append("g")
            .attr("transform", `translate(${width},0)`) // Đặt trục Y2 bên phải
            .call(d3.axisRight(y2).ticks(5).tickFormat(d => `${d.toFixed(0)}%`));

        y2Axis.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.right - 20) // Điều chỉnh vị trí
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "orangered")
            .style("font-size", "12px")
            .text("Biên Lợi Nhuận (%)");
        
        // Đường tham chiếu 0% cho Biên lợi nhuận
        if (y2.domain()[0] < 0 && y2.domain()[1] > 0) { // Chỉ vẽ nếu 0% nằm trong dải trục Y2
            svg.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", y2(0))
                .attr("y2", y2(0))
                .attr("stroke", "grey")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "3,3");
        }

        // Vẽ đường Biên lợi nhuận
        svg.append("path")
            .datum(dataForChart)
            .attr("fill", "none")
            .attr("stroke", "orangered")
            .attr("stroke-width", 2.5)
            .attr("d", d3.line()
                .x(d => x(d.Country) + x.bandwidth() / 2) // Điểm ở giữa mỗi cột
                .y(d => y2(d.Profit_Margin_Overall))
            );
        
        // Vẽ các điểm tròn trên đường Biên lợi nhuận
        const dots = svg.selectAll(".dot-country-margin")
            .data(dataForChart)
            .join("circle")
              .attr("class", "dot-country-margin")
              .attr("cx", d => x(d.Country) + x.bandwidth() / 2)
              .attr("cy", d => y2(d.Profit_Margin_Overall))
              .attr("r", 5)
              .attr("fill", "orangered")
              .style("cursor", "pointer");

        // Thêm Tooltip cho cả cột và điểm tròn
        bars.on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut);
        dots.on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut);

        function handleMouseOver(event, d) {
            tooltipElement.transition().duration(100).style("opacity", .95);
            tooltipElement.html(
                `<strong>${d.Country}</strong><br/>
                 Doanh thu: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                 Lợi nhuận: $${d.Total_Profit.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                 Biên LN: ${d.Profit_Margin_Overall.toFixed(1)}%`
            )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
            
            // Highlight cột/điểm được hover (tùy chọn)
            d3.select(this).style("filter", "brightness(1.2)");
        }

        function handleMouseOut(event, d) {
            tooltipElement.transition().duration(300).style("opacity", 0);
            d3.select(this).style("filter", "brightness(1)");
        }

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q1 (Top 5 Quốc gia): ${error.message}</p>`);
        console.error("Lỗi drawChartQ1:", error);
    }
}
// Đảm bảo không có dòng code nào khác ở đây sau dấu đóng } của hàm.
// Ví dụ: không có dòng "chartQ1" ở cuối file.