// Đề xuất đặt tên file là: static/dashboard_app/js/chartQ3.js

async function drawChartQ3(containerSelector, tooltipElement, dataPath) { // Đổi tên hàm, sử dụng dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html("");  // xóa nội dung cũ

    try {
        // SỬ DỤNG dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath); 
        if (!allData || allData.length === 0) {
            // Cập nhật thông báo lỗi để phản ánh việc tải từ dataPath
            throw new Error(`Không tải được file dữ liệu từ '${dataPath}' hoặc file rỗng.`);
        }

        // 2. Lọc US và rollup theo City (LOGIC NÀY VẪN GIỮ NGUYÊN TỪ Q2/Q3 trước)
        const usData = allData.filter(d => d.Country === "United States");
        if (usData.length === 0) {
            vizContainer.append("p").text("Không tìm thấy dữ liệu cho Hoa Kỳ trong file được cung cấp.");
            return;
        }
        const dataByCity = d3.rollup(
            usData,
            v => ({
                TotalSales: d3.sum(v, d => +d.Sales || 0),
                TotalProfit: d3.sum(v, d => +d.Profit || 0),
                State: v[0].State
            }),
            d => d.City
        );

        // 3. Chuyển array & tính ProfitMargin (LOGIC NÀY VẪN GIỮ NGUYÊN)
        let processed = [];
        dataByCity.forEach((m, city) => {
            processed.push({
                City: city,
                State: m.State,
                TotalSales: m.TotalSales,
                TotalProfit: m.TotalProfit,
                ProfitMargin: m.TotalSales ? m.TotalProfit / m.TotalSales : 0
            });
        });

        // 4. Lọc >0, sort TotalSales giảm dần, lấy Top5 (LOGIC NÀY VẪN GIỮ NGUYÊN)
        processed = processed
            .filter(d => d.TotalSales > 0)
            .sort((a, b) => b.TotalSales - a.TotalSales)
            .slice(0, 5);

        if (processed.length < 5) {
            vizContainer.append("p").text("Không có đủ dữ liệu Top 5 thành phố của Hoa Kỳ sau khi xử lý.");
            return;
        }

        // 5. Tạo wrapper canh giữa, rộng 760px
        const box = vizContainer.append("div")
            .attr("class", "chart-box")
            .style("width", "760px")
            .style("margin", "20px auto");

        // 6. Vẽ bảng (LOGIC NÀY VẪN GIỮ NGUYÊN)
        const table = box.append("table").attr("class", "state-city-table");
        table.append("caption")
            .attr("class", "chart-title")
            .text("Top 5 Thành phố Hoa Kỳ theo Doanh thu và Biên lợi nhuận (Q3)"); // Tiêu đề cụ thể cho Q3

        const thead = table.append("thead").append("tr");
        thead.append("th").text("State");
        thead.append("th").text("City");
        thead.append("th").text("Sales & Profit Margin");  // Cập nhật tiêu đề cột bar

        const tbody = table.append("tbody");
        const rows = tbody.selectAll("tr")
            .data(processed)
            .enter()
            .append("tr");

        rows.append("td").text(d => d.State);
        rows.append("td").text(d => d.City);

        // 7. Scale chiều dài bar theo TotalSales
        const barMaxW = 500;  // max bar width
        const maxSales = d3.max(processed, d => d.TotalSales);
        const xSales = d3.scaleLinear()
            .domain([0, maxSales > 0 ? maxSales : 1]) // Tránh domain [0,0] nếu không có sales
            .range([0, barMaxW]);

        // 8. Vẽ bar + label
        const cells = rows.append("td").attr("class", "bar-chart-cell");
        const barH = 20, labelPad = 6;

        cells.each(function(d) {
            const svg = d3.select(this)
                .append("svg")
                .attr("width", barMaxW + 80) 
                .attr("height", barH);

            // Bar rectangle
            svg.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", xSales(d.TotalSales))
                .attr("height", barH)
                .attr("fill", () => { 
                    if (d.City === "New York City")     return "#1f77b4";
                    else if (d.City === "Los Angeles")  return "#ff7f0e"; // Thay đổi màu cho LA nếu muốn
                    else if (d.City === "Seattle")      return "#2ca02c"; // Thay đổi màu cho Seattle
                    else if (d.City === "San Francisco") return "#d62728"; // Thay đổi màu
                    else if (d.City === "Philadelphia")  return "#9467bd"; // Thay đổi màu
                    else                                 return "#8c564b"; // Màu mặc định
                })
                .on("mouseover", evt => {
                    tooltipElement
                        .style("opacity", 0.9)
                        .html(`
                            <strong>State:</strong> ${d.State}<br/>
                            <strong>City:</strong> ${d.City}<br/>
                            <strong>Tổng doanh thu:</strong> $${d.TotalSales.toLocaleString()}<br/>
                            <strong>Tổng lợi nhuận:</strong> $${d.TotalProfit.toLocaleString()}<br/>
                            <strong>Biên lợi nhuận:</strong> ${(d.ProfitMargin*100).toFixed(2)}%
                        `)
                        .style("left", (evt.pageX + 10) + "px")
                        .style("top",  (evt.pageY - 28) + "px");
                })
                .on("mouseout", () => {
                    tooltipElement.style("opacity", 0);
                });

            // Label ProfitMargin%
            svg.append("text")
                .attr("x", xSales(d.TotalSales) + labelPad)
                .attr("y", barH / 2)
                .attr("dy", "0.35em")
                .style("font-size", "10px")
                .style("fill", "#333")
                .text(`${(d.ProfitMargin*100).toFixed(0)}%`);
        });

    } catch (err) {
        vizContainer.append("p")
            .style("color", "red")
            .text(`Lỗi khi vẽ Biểu đồ Q3: ${err.message}`); 
        console.error("Lỗi drawChartQ3:", err); // Thêm thông tin cho console log
    }
}
