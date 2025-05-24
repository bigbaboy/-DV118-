// chartQ11.js

async function drawChartQ11(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales);
            d.Profit = parseFloat(d.Profit);
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0; // Doanh thu không thể âm
            if (isNaN(d.Profit)) d.Profit = 0; // Lợi nhuận có thể âm
            // (Kiểm tra lại tên cột trong CSV của bạn, có thể là 'Sub-Category' viết hoa chữ S, hoặc khác)
            if (typeof d['Sub-Category'] === 'undefined' || d['Sub-Category'] === null || String(d['Sub-Category']).trim() === "") {
                d['Sub-Category'] = "Không xác định";
            }
        });

        const profitMarginBySubCategory = d3.rollup(allData,
            v => ({
                Total_Sales: d3.sum(v, d => d.Sales),
                Total_Profit: d3.sum(v, d => d.Profit)
            }),
            d => d['Sub-Category'] // Đảm bảo tên cột này chính xác trong CSV
        );

        let dataForChart = Array.from(profitMarginBySubCategory, ([key, value]) => ({
            'Sub-Category': key,
            Total_Sales: value.Total_Sales,
            Total_Profit: value.Total_Profit,
            'Profit_Margin_%': (value.Total_Sales !== 0) ? (value.Total_Profit / value.Total_Sales) * 100 : 0
        }));

        // Lọc bỏ các Sub-Category không hợp lệ (ví dụ Sales = 0 dẫn đến Profit_Margin_% có thể là NaN hoặc Infinity)
        dataForChart = dataForChart.filter(d => 
            d['Sub-Category'] !== "Không xác định" && 
            !isNaN(d['Profit_Margin_%']) && 
            isFinite(d['Profit_Margin_%']) // Loại bỏ Infinity nếu Sales là 0 và Profit khác 0
        );
        
        // Sắp xếp theo Profit_Margin_% giảm dần (giống code Python)
        dataForChart.sort((a, b) => b['Profit_Margin_%'] - a['Profit_Margin_%']);
        // Giới hạn số lượng Sub-Category hiển thị nếu muốn, ví dụ tất cả 17 sub-category
        // dataForChart = dataForChart.slice(0, 17);


        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Sub-Category hợp lệ để vẽ biểu đồ Q11.</p>");
            return;
        }
        // console.log("Data for Profit Margin by Sub-Category (Q11):", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT NGANG ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 700;
        const barHeightUnit = 22; 
        const titleAndMarginHeight = 100;
        const baseHeight = Math.min(700, dataForChart.length * barHeightUnit + titleAndMarginHeight); // Giới hạn chiều cao max

        const chartWidth = Math.max(400, baseWidth);
        const chartHeight = Math.max(300, baseHeight); 
        
        const margin = { top: 50, right: 60, bottom: 50, left: 130 };

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Sắp xếp lại dữ liệu để Sub-Category có Profit_Margin_% cao nhất ở trên cùng
        // (D3 scaleBand vẽ domain theo thứ tự được cung cấp từ trên xuống)
        // Vì dataForChart đã sort giảm dần theo Profit_Margin_%, nên không cần sort lại ở đây cho Y-axis
        // Chỉ cần đảo ngược range của Y scale hoặc không.
        // Để giữ thứ tự đã sort (cao nhất ở trên), Y range sẽ là [0, height]

        // Y Axis (Tên Sub-Category)
        const y = d3.scaleBand()
            .range([0, height]) 
            .domain(dataForChart.map(d => d['Sub-Category'])) // Domain đã được sort theo Profit_Margin_% giảm dần
            .padding(0.15); 

        svg.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(6))
            .selectAll("text")
                .style("font-size", "9px");
        
        svg.append("text") // Nhãn trục Y
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left + 10) 
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle").style("font-size", "11px").style("fill", "#333")
            .text("Sub-Category");

        // X Axis (Tỷ suất lợi nhuận %) - Có thể có giá trị âm
        const xMinMargin = d3.min(dataForChart, d => d['Profit_Margin_%']);
        const xMaxMargin = d3.max(dataForChart, d => d['Profit_Margin_%']);
        
        // Đảm bảo 0% nằm trong dải trục X nếu có cả âm và dương
        let xDomainMin = xMinMargin < 0 ? xMinMargin * 1.1 : 0; // Thêm padding nếu âm
        let xDomainMax = xMaxMargin > 0 ? xMaxMargin * 1.1 : (xMaxMargin === 0 ? 10 : xMaxMargin * 0.9); // Thêm padding nếu dương
        if (xMinMargin >= 0 && xMaxMargin >=0) xDomainMin = 0; // Nếu tất cả đều dương, bắt đầu từ 0
        if (xMinMargin <= 0 && xMaxMargin <=0) xDomainMax = 0; // Nếu tất cả đều âm, kết thúc ở 0

        // Xử lý trường hợp min = max (ví dụ tất cả margin = 0)
        if (xDomainMin === xDomainMax) {
            xDomainMin -= 10;
            xDomainMax += 10;
        }


        const x = d3.scaleLinear()
            .domain([xDomainMin, xDomainMax]) 
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(Math.min(7, width/70)).tickFormat(d => `${d.toFixed(0)}%`)) 
            .selectAll("text")
                .style("font-size", "9px");
        
        // Đường 0% trên trục X
        if (xDomainMin < 0 && xDomainMax > 0) {
            svg.append("line")
                .attr("x1", x(0))
                .attr("x2", x(0))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "grey")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "3,3");
        }

        svg.append("text") // Nhãn trục X
            .attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom * 0.75)
            .style("font-size", "11px").style("fill", "#333")
            .text("Tỷ suất lợi nhuận (%)");

        // Color Scale (Tương tự palette 'Blues_r' của Seaborn)
        // Blues_r: giá trị cao hơn thì màu nhạt hơn.
        // D3: d3.interpolateBlues, giá trị cao hơn thì màu đậm hơn. Để đảo ngược, dùng domain ngược hoặc custom interpolator.
        // Cách đơn giản là dùng một dải màu xanh cố định hoặc scale theo giá trị.
        // Nếu dùng Blues_r (giá trị cao -> màu nhạt):
        const colorBluesR = d3.scaleSequential(t => d3.interpolateBlues(1 - t)) // Đảo ngược interpolator
                               .domain([xMaxMargin, xMinMargin]); // Domain ngược lại
        // Hoặc dùng màu xanh dương đơn giản hơn, hoặc một dải màu cho dễ nhìn giá trị âm/dương
        // Ví dụ dùng màu khác nhau cho âm và dương:
        // const colorProfitMargin = d => d['Profit_Margin_%'] < 0 ? "tomato" : "steelblue";


        // Vẽ các thanh ngang
        const barsTQ11 = svg.selectAll(".bar-tq11-profit-margin")
            .data(dataForChart)
            .join("rect")
              .attr("class", "bar-tq11-profit-margin")
              .attr("y", d => y(d['Sub-Category']))
              .attr("x", d => d['Profit_Margin_%'] < 0 ? x(d['Profit_Margin_%']) : x(0)) // Thanh âm bắt đầu từ giá trị âm
              .attr("width", d => Math.abs(x(d['Profit_Margin_%']) - x(0))) // Chiều rộng là độ lớn của margin
              .attr("height", y.bandwidth())
              .attr("fill", d => d['Profit_Margin_%'] < 0 ? "#ff7f50" : "#6baed6") // Ví dụ: Cam cho âm, Xanh cho dương
              // .attr("fill", d => colorBluesR(d['Profit_Margin_%'])) // Nếu dùng Blues_r
              .style("cursor", "pointer");

        // Thêm text giá trị % trên/gần mỗi thanh
        svg.selectAll(".bar-value-tq11")
            .data(dataForChart)
            .join("text")
            .attr("class", "bar-value-tq11")
            .attr("y", d => y(d['Sub-Category']) + y.bandwidth() / 2)
            .attr("dy", "0.35em") 
            .style("font-size", "9px")
            .style("font-weight", "bold")
            .text(d => `${d['Profit_Margin_%'].toFixed(2)}%`)
            .attr("x", d => { // Đặt text bên trong hoặc bên ngoài thanh tùy giá trị âm/dương
                if (d['Profit_Margin_%'] < 0) {
                    return x(d['Profit_Margin_%']) - 5; // Bên trái của thanh âm
                } else {
                    return x(d['Profit_Margin_%']) + 5; // Bên phải của thanh dương
                }
            })
            .style("text-anchor", d => d['Profit_Margin_%'] < 0 ? "end" : "start")
            .style("fill", d => d['Profit_Margin_%'] < 0 ? "orangered" : "black"); // Màu cam cho text âm

        
        // Tooltip
        barsTQ11
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>${d['Sub-Category']}</strong><br/>
                     Tỷ suất LN: ${d['Profit_Margin_%'].toFixed(2)}%<br/>
                     (Doanh thu: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}, 
                     Lợi nhuận: $${d.Total_Profit.toLocaleString(undefined, {maximumFractionDigits:0})})`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).style("filter", "brightness(1.15)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        // Tiêu đề
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2)) 
            .attr("text-anchor", "middle")
            .style("font-size", "16px").style("font-weight", "bold").style("fill", "#333")


    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q11: ${error.message}</p>`);
        console.error("Lỗi drawChartQ11:", error);
    }
}