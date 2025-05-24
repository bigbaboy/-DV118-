// chartQ6.js

async function drawChartQ6(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU:
        // Code Python của bạn là:
        // orders_by_segment = df_orders.groupby('segment')['Order ID'].nunique().reset_index()
        // orders_by_segment.rename(columns={'Order ID': 'Số lần mua hàng'}, inplace=True)

        // Chuyển đổi trong D3.js:
        const ordersBysegmentRollup = d3.rollup(allData,
            v => new Set(v.map(d => d['Order ID'])).size, // Đếm Order ID duy nhất
            d => d.segment // Tên cột Phân khúc - ĐẢM BẢO TÊN CỘT NÀY CHÍNH XÁC TRONG CSV (segment hay Segment?)
        );

        let dataForChart = Array.from(ordersBysegmentRollup, ([key, value]) => ({
            segment: key || "N/A",
            'Số lần mua hàng': value || 0
        }));

        // Sắp xếp theo thứ tự mong muốn (ví dụ: Consumer, Corporate, Home Office) nếu cần
        const segmentOrder = ["Consumer", "Corporate", "Home Office"];
        dataForChart.sort((a, b) => segmentOrder.indexOf(a.segment) - segmentOrder.indexOf(b.segment));
        
        // Hoặc sắp xếp theo số lần mua hàng
        // dataForChart.sort((a,b) => b['Số lần mua hàng'] - a['Số lần mua hàng']);


        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Phân khúc hợp lệ để vẽ biểu đồ Q6.</p>");
            return;
        }
        // console.log("Data for Bar Chart Q6:", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT ĐỨNG ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.95 : 500;
        const baseHeight = 400; // Chiều cao cố định hoặc tính toán

        const chartWidth = Math.max(300, baseWidth);
        const chartHeight = Math.max(250, baseHeight);
        
        const margin = { top: 40, right: 30, bottom: 70, left: 60 };

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis (Phân khúc khách hàng)
        const x = d3.scaleBand()
            .range([0, width])
            .domain(dataForChart.map(d => d.segment))
            .padding(0.4); // Tăng padding để cột tách biệt hơn

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
                .style("text-anchor", "middle") // Căn giữa nếu tên ngắn, hoặc xoay nếu cần
                .style("font-size", "11px");
        
        svg.append("text") // Nhãn trục X
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom / 2 + 10) // Điều chỉnh vị trí
            .style("font-size", "12px")
            .text("Phân khúc khách hàng");


        // Y Axis (Số lần mua hàng)
        const yMax = d3.max(dataForChart, d => d['Số lần mua hàng']);
        const y = d3.scaleLinear()
            .domain([0, yMax > 0 ? yMax * 1.1 : 10]) // Thêm 10% padding, đảm bảo domain không phải [0,0]
            .range([height, 0]);

        const yAxis = svg.append("g")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",.0f"))); // Định dạng số nguyên

        yAxis.append("text") // Nhãn trục Y
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 15)
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "#333")
            .style("font-size", "12px")
            .text("Số lần mua hàng");

        // Color Scale (Giống màu trong code Python của bạn)
        // Python: color=['#6574cd', '#fbb6ce', '#fdc9a9']
        // Consumer, Corporate, Home Office
        const colors = ['#6574cd', '#fbb6ce', '#fdc9a9']; // Theo thứ tự của segmentOrder
        const color = d3.scaleOrdinal()
            .domain(segmentOrder) // Hoặc dataForChart.map(d => d.segment) nếu không sort theo order
            .range(colors);

        // Vẽ các cột
        const bars = svg.selectAll(".bar-q6")
            .data(dataForChart)
            .join("rect")
              .attr("class", "bar-q6")
              .attr("x", d => x(d.segment))
              .attr("y", d => y(d['Số lần mua hàng']))
              .attr("width", x.bandwidth())
              .attr("height", d => Math.max(0, height - y(d['Số lần mua hàng'])))
              .attr("fill", d => color(d.segment))
              .style("cursor", "pointer");

        // Thêm text giá trị trên mỗi cột (tùy chọn)
        svg.selectAll(".bar-value-q6")
            .data(dataForChart)
            .join("text")
            .attr("class", "bar-value-q6")
            .attr("x", d => x(d.segment) + x.bandwidth() / 2)
            .attr("y", d => y(d['Số lần mua hàng']) - 5) // Phía trên cột một chút
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#333")
            .text(d => d['Số lần mua hàng'].toLocaleString());
        
        // Tooltip
        bars
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Phân khúc: ${d.segment}</strong><br/>
                     Số lần mua hàng: ${d['Số lần mua hàng'].toLocaleString()}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).style("filter", "brightness(0.85)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        // Tiêu đề cho biểu đồ
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2) + 5) // Đặt tiêu đề ở trên cùng, căn giữa
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "600")
            .style("fill", "#333")
            .text("Số lần mua hàng theo phân khúc khách hàng"); // ĐÃ SỬA: Thêm tiêu đề
        
    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q6: ${error.message}</p>`);
        console.error("Lỗi drawChartQ6:", error);
    }
}